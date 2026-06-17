using BackOffice.Application.DTOs.Main.SmtpSettings;
using BackOffice.Application.Extensions;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.Security;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main;

public class SmtpAdminService : ISmtpAdminService
{
    private readonly MainDBContext _mainDb;
    private readonly ITenantDbContextFactory _tenantDbContextFactory;
    private readonly IPasswordCipher _passwordCipher;
    private readonly ILogger<SmtpAdminService> _logger;

    private static readonly (int OptionId, string OptionName)[] OptionMeta =
    {
        (SmtpOptionIds.OutgoingMailServer, "BO Outgoing mail server"),
        (SmtpOptionIds.OutgoingMailPort,   "BO Outgoing mail port number"),
        (SmtpOptionIds.UseSsl,             "BO Use SSL"),
        (SmtpOptionIds.EmailAddress,       "BO Email Address"),
        (SmtpOptionIds.EmailPassword,      "BO Email Password"),
        (SmtpOptionIds.StoreEmail,         "Store Email"),
    };

    public SmtpAdminService(
        MainDBContext mainDb,
        ITenantDbContextFactory tenantDbContextFactory,
        IPasswordCipher passwordCipher,
        ILogger<SmtpAdminService> logger)
    {
        _mainDb = mainDb;
        _tenantDbContextFactory = tenantDbContextFactory;
        _passwordCipher = passwordCipher;
        _logger = logger;
    }

    public async Task<ApiResponse<SmtpSettingsDto>> GetAsync(int customerId, Guid storeId)
    {
        var customer = await _mainDb.Customers.AsNoTracking()
            .FirstOrDefaultAsync(c => c.CustomerId == customerId);
        if (customer is null)
            return ApiResponseFactory.NotFound<SmtpSettingsDto>("Tenant not found.");

        await using var tenantDb = _tenantDbContextFactory.CreateForCustomer(
            customer.ServerName, customer.DBName, customer.DBUser, customer.ResolveDBPassword(_passwordCipher));

        var rows = await tenantDb.Set<SetUpValue>()
            .AsNoTracking()
            .Where(v => SmtpOptionIds.All.Contains(v.OptionID)
                        && (v.StoreID == storeId || v.StoreID == Guid.Empty))
            .Select(v => new { v.StoreID, v.OptionID, v.OptionValue })
            .ToListAsync();

        string? StoreVal(int id) => rows.FirstOrDefault(r => r.StoreID == storeId && r.OptionID == id)?.OptionValue;
        string? GlobalVal(int id) => rows.FirstOrDefault(r => r.StoreID == Guid.Empty && r.OptionID == id)?.OptionValue;
        string? Best(int id) => StoreVal(id) ?? GlobalVal(id);

        var host = Best(SmtpOptionIds.OutgoingMailServer);
        var portStr = Best(SmtpOptionIds.OutgoingMailPort);
        var email = Best(SmtpOptionIds.EmailAddress);
        var pass = Best(SmtpOptionIds.EmailPassword);

        var isComplete = !string.IsNullOrWhiteSpace(host)
                         && int.TryParse(portStr, out var p) && p > 0 && p <= 65535
                         && !string.IsNullOrWhiteSpace(email) && email!.Contains('@')
                         && !string.IsNullOrWhiteSpace(pass);

        string source;
        if (rows.Any(r => r.StoreID == storeId && !string.IsNullOrWhiteSpace(r.OptionValue)))
            source = "store";
        else if (rows.Any(r => r.StoreID == Guid.Empty && !string.IsNullOrWhiteSpace(r.OptionValue)))
            source = "global";
        else
            source = "appsettings";

        return ApiResponseFactory.Success(new SmtpSettingsDto
        {
            CustomerId = customerId,
            StoreId = storeId,
            Host = host,
            Port = int.TryParse(portStr, out var pp) ? pp : null,
            UseSsl = ParseBool(Best(SmtpOptionIds.UseSsl)),
            EmailAddress = email,
            // Return real password — super-admin UI shows it with a visibility toggle.
            Password = pass,
            StoreEmail = Best(SmtpOptionIds.StoreEmail),
            IsComplete = isComplete,
            Source = source
        });
    }

    public async Task<ApiResponse<List<SmtpStoreLookupDto>>> GetStoresAsync(int customerId)
    {
        var customer = await _mainDb.Customers.AsNoTracking()
            .FirstOrDefaultAsync(c => c.CustomerId == customerId);
        if (customer is null)
            return ApiResponseFactory.NotFound<List<SmtpStoreLookupDto>>("Tenant not found.");

        await using var tenantDb = _tenantDbContextFactory.CreateForCustomer(
            customer.ServerName, customer.DBName, customer.DBUser, customer.ResolveDBPassword(_passwordCipher));

        var stores = await tenantDb.Set<Store>()
            .AsNoTracking()
            .Where(s => s.Status == null || s.Status >= 0)
            .OrderByDescending(s => s.IsMainStore ?? false)
            .ThenBy(s => s.StoreName)
            .Select(s => new SmtpStoreLookupDto
            {
                StoreId = s.StoreID,
                StoreName = s.StoreName ?? "(unnamed store)",
                IsMainStore = s.IsMainStore ?? false
            })
            .ToListAsync();

        return ApiResponseFactory.Success(stores);
    }

    public async Task<ApiResponse<object>> UpdateAsync(int customerId, SmtpSettingsUpdateDto dto, Guid? userId)
    {
        var customer = await _mainDb.Customers.AsNoTracking()
            .FirstOrDefaultAsync(c => c.CustomerId == customerId);
        if (customer is null)
            return ApiResponseFactory.NotFound<object>("Tenant not found.");

        if (dto.Port is not null && (dto.Port <= 0 || dto.Port > 65535))
            return ApiResponseFactory.BadRequest<object>("Port must be between 1 and 65535.");

        await using var tenantDb = _tenantDbContextFactory.CreateForCustomer(
            customer.ServerName, customer.DBName, customer.DBUser, customer.ResolveDBPassword(_passwordCipher));

        var values = new (int OptionId, string? Value)[]
        {
            (SmtpOptionIds.OutgoingMailServer, dto.Host?.Trim()),
            (SmtpOptionIds.OutgoingMailPort,   dto.Port?.ToString()),
            (SmtpOptionIds.UseSsl,             dto.UseSsl ? "1" : "0"),
            (SmtpOptionIds.EmailAddress,       dto.EmailAddress?.Trim()),
            (SmtpOptionIds.EmailPassword,      dto.Password),
            (SmtpOptionIds.StoreEmail,         dto.StoreEmail?.Trim()),
        };

        var existing = await tenantDb.Set<SetUpValue>()
            .Where(v => v.StoreID == dto.StoreId && SmtpOptionIds.All.Contains(v.OptionID))
            .ToListAsync();

        foreach (var (optionId, value) in values)
        {
            if (value is null) continue; // null = untouched; empty string = explicit clear

            var row = existing.FirstOrDefault(r => r.OptionID == optionId);
            if (row is null)
            {
                row = new SetUpValue
                {
                    OptionID = optionId,
                    StoreID = dto.StoreId,
                    OptionName = OptionMeta.First(m => m.OptionId == optionId).OptionName,
                    OptionValue = value,
                    Status = 1,
                    DateCreated = DateTime.UtcNow,
                    DateModified = DateTime.UtcNow,
                    UserCreated = userId,
                    UserModified = userId,
                };
                tenantDb.Set<SetUpValue>().Add(row);
            }
            else
            {
                row.OptionValue = value;
                row.DateModified = DateTime.UtcNow;
                row.UserModified = userId;
            }
        }

        await tenantDb.SaveChangesAsync();
        _logger.LogInformation("SMTP SetupValues updated for Customer {CustomerId}, Store {StoreId}", customerId, dto.StoreId);
        return ApiResponseFactory.Success<object>(null, "SMTP settings saved.");
    }

    private static bool ParseBool(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return false;
        v = v.Trim();
        if (bool.TryParse(v, out var b)) return b;
        return v is "1" or "yes" or "YES" or "Yes" or "Y" or "y" or "on" or "ON";
    }
}
