using BackOffice.Application.Extensions;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.Security;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MainCustomer = BackOffice.Domain.Entities.Main.Customer;

namespace BackOffice.Persistence.Services.Main;

public class SmtpSettingsResolver : ISmtpSettingsResolver
{
    private static readonly Guid GlobalStoreId = Guid.Empty;

    private readonly MainDBContext _mainDb;
    private readonly ITenantDbContextFactory _tenantDbContextFactory;
    private readonly IConfiguration _configuration;
    private readonly IPasswordCipher _passwordCipher;
    private readonly ILogger<SmtpSettingsResolver> _logger;

    public SmtpSettingsResolver(
        MainDBContext mainDb,
        ITenantDbContextFactory tenantDbContextFactory,
        IConfiguration configuration,
        IPasswordCipher passwordCipher,
        ILogger<SmtpSettingsResolver> logger)
    {
        _mainDb = mainDb;
        _tenantDbContextFactory = tenantDbContextFactory;
        _configuration = configuration;
        _passwordCipher = passwordCipher;
        _logger = logger;
    }

    public async Task<SmtpSettings> ResolveAsync(int? customerId, Guid? storeId, CancellationToken ct = default)
    {
        var appSettings = LoadAppSettings();

        if (customerId is null or 0)
        {
            _logger.LogDebug("SMTP resolver: no customerId provided, using App Settings.");
            return appSettings;
        }

        MainCustomer? customer;
        try
        {
            customer = await _mainDb.Customers
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.CustomerId == customerId, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SMTP resolver: could not look up Customer {CustomerId}, falling back to App Settings.", customerId);
            return appSettings;
        }

        if (customer is null)
        {
            _logger.LogDebug("SMTP resolver: Customer {CustomerId} not found, using App Settings.", customerId);
            return appSettings;
        }

        Dictionary<int, string?> storeRows;
        Dictionary<int, string?> globalRows;
        try
        {
            await using var tenantDb = _tenantDbContextFactory.CreateForCustomer(
                customer.ServerName, customer.DBName, customer.DBUser, customer.ResolveDBPassword(_passwordCipher));

            var targetStoreId = storeId ?? GlobalStoreId;

            var rows = await tenantDb.Set<SetUpValue>()
                .AsNoTracking()
                .Where(v => SmtpOptionIds.All.Contains(v.OptionID)
                            && (v.StoreID == targetStoreId || v.StoreID == GlobalStoreId))
                .Select(v => new { v.StoreID, v.OptionID, v.OptionValue })
                .ToListAsync(ct);

            storeRows = rows.Where(r => r.StoreID == targetStoreId)
                .ToDictionary(r => r.OptionID, r => r.OptionValue);
            globalRows = rows.Where(r => r.StoreID == GlobalStoreId)
                .ToDictionary(r => r.OptionID, r => r.OptionValue);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SMTP resolver: could not read SetupValues for Customer {CustomerId}, falling back to App Settings.", customerId);
            return appSettings;
        }

        if (TryBuild(storeRows, appSettings, out var storeLevel))
        {
            _logger.LogInformation("SMTP resolver: using store-level SetupValues for Customer {CustomerId}, Store {StoreId}.", customerId, storeId);
            return storeLevel;
        }

        if (storeId is not null && storeId != GlobalStoreId && TryBuild(globalRows, appSettings, out var globalLevel))
        {
            _logger.LogInformation("SMTP resolver: using global (StoreID=Empty) SetupValues for Customer {CustomerId}.", customerId);
            return globalLevel;
        }

        _logger.LogInformation("SMTP resolver: SetupValues incomplete for Customer {CustomerId}, Store {StoreId}, using App Settings.", customerId, storeId);
        return ApplyStoreEmailOnly(storeRows, globalRows, appSettings);
    }

    private SmtpSettings LoadAppSettings()
    {
        var s = _configuration.GetSection("SmtpSettings");
        return new SmtpSettings
        {
            Host = s["Host"] ?? string.Empty,
            Port = int.TryParse(s["Port"], out var p) ? p : 587,
            Username = s["Username"] ?? string.Empty,
            Password = s["Password"] ?? string.Empty,
            FromEmail = s["FromEmail"] ?? string.Empty,
            FromName = s["FromName"] ?? "RDT System",
            UseSsl = bool.TryParse(s["UseSsl"], out var u) && u
        };
    }

    private static bool TryBuild(
        IReadOnlyDictionary<int, string?> rows,
        SmtpSettings appSettings,
        out SmtpSettings settings)
    {
        settings = new SmtpSettings();

        var host = Get(rows, SmtpOptionIds.OutgoingMailServer);
        var portStr = Get(rows, SmtpOptionIds.OutgoingMailPort);
        var email = Get(rows, SmtpOptionIds.EmailAddress);
        var pass = Get(rows, SmtpOptionIds.EmailPassword);

        if (string.IsNullOrWhiteSpace(host)) return false;
        if (!int.TryParse(portStr, out var port) || port <= 0 || port > 65535) return false;
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return false;
        if (string.IsNullOrWhiteSpace(pass)) return false;

        var ssl = ParseBool(Get(rows, SmtpOptionIds.UseSsl));
        var storeEmail = Get(rows, SmtpOptionIds.StoreEmail);
        var fromEmail = IsValidEmail(storeEmail) ? storeEmail! : email;

        settings.Host = host;
        settings.Port = port;
        settings.Username = email;
        settings.Password = pass;
        settings.UseSsl = ssl;
        settings.FromEmail = fromEmail;
        settings.FromName = string.IsNullOrWhiteSpace(appSettings.FromName) ? "RDT System" : appSettings.FromName;
        return true;
    }

    private static SmtpSettings ApplyStoreEmailOnly(
        IReadOnlyDictionary<int, string?> storeRows,
        IReadOnlyDictionary<int, string?> globalRows,
        SmtpSettings appSettings)
    {
        var storeEmail = Get(storeRows, SmtpOptionIds.StoreEmail);
        if (!IsValidEmail(storeEmail))
            storeEmail = Get(globalRows, SmtpOptionIds.StoreEmail);

        if (!IsValidEmail(storeEmail))
            return appSettings;

        return new SmtpSettings
        {
            Host = appSettings.Host,
            Port = appSettings.Port,
            Username = appSettings.Username,
            Password = appSettings.Password,
            UseSsl = appSettings.UseSsl,
            FromEmail = storeEmail!,
            FromName = appSettings.FromName
        };
    }

    private static string? Get(IReadOnlyDictionary<int, string?> rows, int optionId)
        => rows.TryGetValue(optionId, out var v) ? v?.Trim() : null;

    private static bool ParseBool(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return false;
        v = v.Trim();
        if (bool.TryParse(v, out var b)) return b;
        return v is "1" or "yes" or "YES" or "Yes" or "Y" or "y" or "on" or "ON";
    }

    private static bool IsValidEmail(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return false;
        v = v.Trim();
        if (v == "0") return false;
        return v.Contains('@') && v.Length >= 5;
    }
}
