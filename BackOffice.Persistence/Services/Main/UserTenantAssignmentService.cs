using BackOffice.Application.Configuration;
using BackOffice.Application.DTOs.Main.UserTenantAssignment;
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

public class UserTenantAssignmentService : IUserTenantAssignmentService
{
    private readonly MainDBContext _mainDb;
    private readonly ITenantDbContextFactory _tenantDbContextFactory;
    private readonly IPasswordCipher _passwordCipher;
    private readonly ILogger<UserTenantAssignmentService> _logger;
    private readonly Guid _currentEnvironmentId;

    public UserTenantAssignmentService(
        MainDBContext mainDb,
        ITenantDbContextFactory tenantDbContextFactory,
        IPasswordCipher passwordCipher,
        ILogger<UserTenantAssignmentService> logger,
        EnvironmentSettings environmentSettings)
    {
        _mainDb = mainDb;
        _tenantDbContextFactory = tenantDbContextFactory;
        _passwordCipher = passwordCipher;
        _logger = logger;
        _currentEnvironmentId = environmentSettings.CurrentEnvironmentId;
    }

    public async Task<ApiResponse<List<TenantLookupDto>>> GetTenantAssignmentsForUserAsync(int userId)
    {
        try
        {
            var assignedIds = await _mainDb.UserTenantAssignments
                .Where(a => a.UserId == userId)
                .Select(a => a.CustomerId)
                .ToListAsync();

            var assignedSet = new HashSet<int>(assignedIds);

            var tenants = await _mainDb.Customers
                .Where(c => c.IsActive && (_currentEnvironmentId == Guid.Empty || c.EnvironmentId == _currentEnvironmentId))
                .AsNoTracking()
                .OrderBy(c => c.CustomerName)
                .Select(c => new TenantLookupDto
                {
                    CustomerId = c.CustomerId,
                    CustomerName = c.CustomerName,
                    Email = c.Email ?? c.ContactEmail,
                    IsAssigned = assignedSet.Contains(c.CustomerId)
                })
                .ToListAsync();

            return ApiResponseFactory.Success(tenants);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching tenant assignments for user {UserId}", userId);
            return ApiResponseFactory.InternalError<List<TenantLookupDto>>("Failed to load tenant assignments.");
        }
    }

    public async Task<ApiResponse<bool>> AssignTenantsToUserAsync(AssignTenantsToUserDto dto, int assignedBy)
    {
        try
        {
            var appUser = await _mainDb.WebAppUsers.FindAsync(dto.UserId);
            if (appUser == null)
                return ApiResponseFactory.NotFound<bool>("User not found.");

            if (dto.CustomerIds.Count > 0)
            {
                var validCustomerIds = await _mainDb.Customers
                    .Where(c => dto.CustomerIds.Contains(c.CustomerId))
                    .Select(c => c.CustomerId)
                    .ToListAsync();

                if (validCustomerIds.Count != dto.CustomerIds.Count)
                    return ApiResponseFactory.BadRequest<bool>("One or more customer IDs are invalid.");
            }

            var existing = await _mainDb.UserTenantAssignments
                .Where(a => a.UserId == dto.UserId)
                .ToListAsync();

            _mainDb.UserTenantAssignments.RemoveRange(existing);

            if (dto.CustomerIds.Count > 0)
            {
                var newAssignments = dto.CustomerIds.Select(cid => new UserTenantAssignment
                {
                    UserId = dto.UserId,
                    CustomerId = cid,
                    AssignedBy = assignedBy,
                    AssignedAt = DateTime.UtcNow
                }).ToList();

                await _mainDb.UserTenantAssignments.AddRangeAsync(newAssignments);
            }

            await _mainDb.SaveChangesAsync();

            if (dto.CustomerIds.Count > 0)
            {
                await SyncUserToAssignedTenantsAsync(appUser, dto.CustomerIds);
            }

            _logger.LogInformation(
                "User {AssignedBy} assigned {Count} tenants to user {UserId}",
                assignedBy, dto.CustomerIds.Count, dto.UserId);

            return ApiResponseFactory.Success(true, "Tenant assignments updated successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning tenants to user {UserId}", dto.UserId);
            var innerMsg = ex.InnerException?.Message ?? ex.Message;
            return ApiResponseFactory.InternalError<bool>($"Failed to update tenant assignments: {innerMsg}");
        }
    }

    public async Task<ApiResponse<List<UserTenantAssignmentDto>>> GetMyAssignedTenantsAsync(int userId)
    {
        try
        {
            var assignments = await _mainDb.UserTenantAssignments
                .AsNoTracking()
                .Where(a => a.UserId == userId)
                .Join(
                    _mainDb.Customers.Where(c => c.IsActive),
                    a => a.CustomerId,
                    c => c.CustomerId,
                    (a, c) => new UserTenantAssignmentDto
                    {
                        Id = a.Id,
                        UserId = a.UserId,
                        CustomerId = a.CustomerId,
                        CustomerName = c.CustomerName,
                        Email = c.Email ?? c.ContactEmail,
                        AssignedAt = a.AssignedAt
                    })
                .OrderBy(a => a.CustomerName)
                .ToListAsync();

            return ApiResponseFactory.Success(assignments);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching assigned tenants for user {UserId}", userId);
            return ApiResponseFactory.InternalError<List<UserTenantAssignmentDto>>("Failed to load assigned tenants.");
        }
    }

    private async System.Threading.Tasks.Task SyncUserToAssignedTenantsAsync(WebAppUser appUser, List<int> customerIds)
    {
        var customers = await _mainDb.Customers
            .AsNoTracking()
            .Where(c => customerIds.Contains(c.CustomerId))
            .ToListAsync();

        var localUserId = appUser.LocalUserId;

        foreach (var customer in customers)
        {
            try
            {
                await using var tenantDb = _tenantDbContextFactory.CreateForCustomer(
                    customer.ServerName,
                    customer.DBName,
                    customer.DBUser,
                    customer.ResolveDBPassword(_passwordCipher));

                var existsInTenant = await tenantDb.Set<WebUser>()
                    .AnyAsync(u => u.UserId == localUserId);

                if (existsInTenant)
                    continue;

                var tenantUser = new WebUser
                {
                    UserId = localUserId,
                    UserName = appUser.UserName,
                    Password = appUser.Password,
                    UserFName = appUser.UserFName,
                    UserLName = appUser.UserLName,
                    Email = appUser.Email,
                    Address = appUser.Address,
                    HomePhoneNumber = appUser.Phone,
                    WorkPhoneNumber = appUser.WorkPhoneNumber,
                    Fax = appUser.Fax,
                    ZipCode = appUser.ZipCode,
                    IsSuperAdmin = appUser.IsSuperAdmin,
                    Status = appUser.Status ?? 1,
                    DateCreated = DateTime.UtcNow,
                    ScanID = appUser.ScanID,
                    IsLogIn = appUser.IsLogIn
                };

                tenantDb.Set<WebUser>().Add(tenantUser);
                await tenantDb.SaveChangesAsync();

                _logger.LogInformation(
                    "Synced user {LocalUserId} to tenant {CustomerName} (CustomerId={CustomerId})",
                    localUserId, customer.CustomerName, customer.CustomerId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to sync user to tenant {CustomerId}: {Error}",
                    customer.CustomerId, ex.InnerException?.Message ?? ex.Message);
            }
        }
    }
}
