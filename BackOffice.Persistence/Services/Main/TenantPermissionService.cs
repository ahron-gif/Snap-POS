using AutoMapper;
using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    public class TenantPermissionService : ITenantPermissionService
    {
        private readonly MainDBContext _dbContext;
        private readonly IMapper _mapper;
        private readonly ILogger<TenantPermissionService> _logger;

        public TenantPermissionService(
            MainDBContext dbContext,
            IMapper mapper,
            ILogger<TenantPermissionService> logger)
        {
            _dbContext = dbContext;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<ApiResponse<TenantPermissionCeilingDto>> GetTenantCeilingAsync(int tenantId)
        {
            try
            {
                var tenant = await _dbContext.Customers.FindAsync(tenantId);
                if (tenant == null)
                    return ApiResponseFactory.NotFound<TenantPermissionCeilingDto>("Tenant not found.");

                // Get allowed module IDs for this tenant
                var allowedModuleIds = await _dbContext.TenantAllowedModules
                    .Where(x => x.TenantId == tenantId && x.IsEnabled)
                    .Select(x => x.ModuleId)
                    .ToListAsync();

                // Get allowed permission IDs for this tenant
                var allowedPermissionIdsList = await _dbContext.TenantAllowedPermissions
                    .Where(x => x.TenantId == tenantId && x.IsAllowed)
                    .Select(x => x.PermissionId)
                    .ToListAsync();
                var allowedPermissionIds = new HashSet<int>(allowedPermissionIdsList);

                // Build full module tree with screens and permissions
                var allModules = await _dbContext.Modules
                    .Where(m => m.IsActive)
                    .OrderBy(m => m.SortOrder)
                    .ToListAsync();

                var allScreens = await _dbContext.Screens
                    .Where(s => s.IsActive)
                    .OrderBy(s => s.SortOrder)
                    .ToListAsync();

                var allPermissions = await _dbContext.Permissions
                    .Where(p => p.IsActive)
                    .OrderBy(p => p.SortOrder)
                    .ToListAsync();

                var moduleCeilings = allModules.Select(m => new ModuleCeilingDto
                {
                    ModuleId = m.ModuleId,
                    ModuleCode = m.Code,
                    ModuleName = m.ModuleName,
                    IsEnabled = allowedModuleIds.Contains(m.ModuleId),
                    Screens = allScreens
                        .Where(s => s.ModuleId == m.ModuleId)
                        .Select(s => new ScreenCeilingDto
                        {
                            ScreenId = s.Id,
                            ScreenCode = s.Code,
                            ScreenName = s.Name,
                            Permissions = allPermissions
                                .Where(p => p.ScreenId == s.Id)
                                .Select(p => new PermissionCeilingItemDto
                                {
                                    PermissionId = p.Id,
                                    PermissionKey = p.PermissionKey,
                                    PermissionName = p.Name,
                                    Category = p.Category,
                                    IsAllowed = allowedPermissionIds.Contains(p.Id)
                                }).ToList()
                        }).ToList()
                }).ToList();

                return ApiResponseFactory.Success(new TenantPermissionCeilingDto
                {
                    TenantId = tenantId,
                    TenantName = tenant.CustomerName,
                    Modules = moduleCeilings
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching tenant ceiling for tenant {TenantId}", tenantId);
                return ApiResponseFactory.InternalError<TenantPermissionCeilingDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<List<TenantAllowedModuleDto>>> GetTenantAllowedModulesAsync(int tenantId)
        {
            try
            {
                var modules = await (from tam in _dbContext.TenantAllowedModules
                                    join m in _dbContext.Modules on tam.ModuleId equals m.ModuleId
                                    where tam.TenantId == tenantId
                                    orderby m.SortOrder
                                    select new TenantAllowedModuleDto
                                    {
                                        Id = tam.Id,
                                        TenantId = tam.TenantId,
                                        ModuleId = tam.ModuleId,
                                        ModuleName = m.ModuleName,
                                        ModuleCode = m.Code,
                                        IsEnabled = tam.IsEnabled,
                                        EnabledAt = tam.EnabledAt,
                                        DisabledAt = tam.DisabledAt
                                    }).ToListAsync();

                return ApiResponseFactory.Success(modules);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching allowed modules for tenant {TenantId}", tenantId);
                return ApiResponseFactory.InternalError<List<TenantAllowedModuleDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> UpdateTenantAllowedModulesAsync(UpdateTenantAllowedModulesDto dto, int grantedByUserId)
        {
            try
            {
                var tenant = await _dbContext.Customers.FindAsync(dto.TenantId);
                if (tenant == null)
                    return ApiResponseFactory.NotFound<bool>("Tenant not found.");

                // Remove existing records for this tenant
                var existing = await _dbContext.TenantAllowedModules
                    .Where(x => x.TenantId == dto.TenantId)
                    .ToListAsync();

                _dbContext.TenantAllowedModules.RemoveRange(existing);

                // Insert new records based on the dto
                var newRecords = dto.Modules.Select(m => new TenantAllowedModule
                {
                    TenantId = dto.TenantId,
                    ModuleId = m.ModuleId,
                    IsEnabled = m.IsEnabled,
                    EnabledAt = DateTime.UtcNow,
                    DisabledAt = m.IsEnabled ? null : DateTime.UtcNow
                }).ToList();

                await _dbContext.TenantAllowedModules.AddRangeAsync(newRecords);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Tenant allowed modules updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating allowed modules for tenant {TenantId}", dto.TenantId);
                return ApiResponseFactory.InternalError<bool>($"Error updating tenant modules: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<TenantAllowedPermissionDto>>> GetTenantAllowedPermissionsAsync(int tenantId)
        {
            try
            {
                var permissions = await (from tap in _dbContext.TenantAllowedPermissions
                                        join p in _dbContext.Permissions on tap.PermissionId equals p.Id
                                        join m in _dbContext.Modules on p.ModuleId equals m.ModuleId
                                        join s in _dbContext.Screens on p.ScreenId equals s.Id into screenJoin
                                        from s in screenJoin.DefaultIfEmpty()
                                        where tap.TenantId == tenantId
                                        orderby m.ModuleName, s.Name, p.SortOrder
                                        select new TenantAllowedPermissionDto
                                        {
                                            Id = tap.Id,
                                            TenantId = tap.TenantId,
                                            PermissionId = tap.PermissionId,
                                            PermissionKey = p.PermissionKey,
                                            PermissionName = p.Name,
                                            ModuleName = m.ModuleName,
                                            ScreenName = s != null ? s.Name : null,
                                            IsAllowed = tap.IsAllowed,
                                            GrantedAt = tap.GrantedAt
                                        }).ToListAsync();

                return ApiResponseFactory.Success(permissions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching allowed permissions for tenant {TenantId}", tenantId);
                return ApiResponseFactory.InternalError<List<TenantAllowedPermissionDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> UpdateTenantAllowedPermissionsAsync(UpdateTenantAllowedPermissionsDto dto, int grantedByUserId)
        {
            try
            {
                var tenant = await _dbContext.Customers.FindAsync(dto.TenantId);
                if (tenant == null)
                    return ApiResponseFactory.NotFound<bool>("Tenant not found.");

                // Load existing permission records for this tenant
                var existing = await _dbContext.TenantAllowedPermissions
                    .Where(x => x.TenantId == dto.TenantId)
                    .ToDictionaryAsync(x => x.PermissionId, x => x);

                foreach (var item in dto.Permissions)
                {
                    if (existing.TryGetValue(item.PermissionId, out var record))
                    {
                        // Update existing record
                        record.IsAllowed = item.IsAllowed;
                        record.GrantedByUserId = grantedByUserId;
                        record.GrantedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        // Insert new record
                        _dbContext.TenantAllowedPermissions.Add(new TenantAllowedPermission
                        {
                            TenantId = dto.TenantId,
                            PermissionId = item.PermissionId,
                            IsAllowed = item.IsAllowed,
                            GrantedByUserId = grantedByUserId,
                            GrantedAt = DateTime.UtcNow
                        });
                    }
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Tenant allowed permissions updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating allowed permissions for tenant {TenantId}", dto.TenantId);
                return ApiResponseFactory.InternalError<bool>($"Error updating tenant permissions: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> EnableAllPermissionsForTenantAsync(int tenantId, int grantedByUserId)
        {
            try
            {
                var tenant = await _dbContext.Customers.FindAsync(tenantId);
                if (tenant == null)
                    return ApiResponseFactory.NotFound<bool>("Tenant not found.");

                // Remove existing permission records for this tenant
                var existing = await _dbContext.TenantAllowedPermissions
                    .Where(x => x.TenantId == tenantId)
                    .ToListAsync();

                _dbContext.TenantAllowedPermissions.RemoveRange(existing);

                // Get all active permissions and enable them
                var allPermissions = await _dbContext.Permissions
                    .Where(p => p.IsActive)
                    .Select(p => p.Id)
                    .ToListAsync();

                var newRecords = allPermissions.Select(permId => new TenantAllowedPermission
                {
                    TenantId = tenantId,
                    PermissionId = permId,
                    IsAllowed = true,
                    GrantedByUserId = grantedByUserId,
                    GrantedAt = DateTime.UtcNow
                }).ToList();

                await _dbContext.TenantAllowedPermissions.AddRangeAsync(newRecords);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "All permissions enabled for tenant successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enabling all permissions for tenant {TenantId}", tenantId);
                return ApiResponseFactory.InternalError<bool>($"Error enabling permissions: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> SyncTenantPermissionsFromPlanAsync(int tenantId)
        {
            try
            {
                var tenant = await _dbContext.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == tenantId);
                if (tenant == null)
                    return ApiResponseFactory.NotFound<bool>("Tenant not found.");

                if (tenant.Subscription?.PlanId == null)
                    return ApiResponseFactory.BadRequest<bool>("Tenant does not have a plan assigned.");

                // Get module IDs from the tenant's plan
                var planModuleIds = await _dbContext.PlanModules
                    .Where(pm => pm.PlanId == tenant.Subscription.PlanId && pm.IsEnabled)
                    .Select(pm => pm.ModuleId)
                    .ToListAsync();

                if (!planModuleIds.Any())
                    return ApiResponseFactory.BadRequest<bool>("The assigned plan has no modules.");

                // Update TenantAllowedModules: remove old, insert new
                var existingModules = await _dbContext.TenantAllowedModules
                    .Where(x => x.TenantId == tenantId)
                    .ToListAsync();

                _dbContext.TenantAllowedModules.RemoveRange(existingModules);

                var newModuleRecords = planModuleIds.Select(moduleId => new TenantAllowedModule
                {
                    TenantId = tenantId,
                    ModuleId = moduleId,
                    IsEnabled = true,
                    EnabledAt = DateTime.UtcNow
                }).ToList();

                await _dbContext.TenantAllowedModules.AddRangeAsync(newModuleRecords);

                // Enable all permissions for those modules
                var existingPermissions = await _dbContext.TenantAllowedPermissions
                    .Where(x => x.TenantId == tenantId)
                    .ToListAsync();

                _dbContext.TenantAllowedPermissions.RemoveRange(existingPermissions);

                var modulePermissions = await _dbContext.Permissions
                    .Where(p => p.IsActive && planModuleIds.Contains(p.ModuleId))
                    .Select(p => p.Id)
                    .ToListAsync();

                var newPermissionRecords = modulePermissions.Select(permId => new TenantAllowedPermission
                {
                    TenantId = tenantId,
                    PermissionId = permId,
                    IsAllowed = true,
                    GrantedAt = DateTime.UtcNow
                }).ToList();

                await _dbContext.TenantAllowedPermissions.AddRangeAsync(newPermissionRecords);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Tenant permissions synced from plan successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing permissions from plan for tenant {TenantId}", tenantId);
                return ApiResponseFactory.InternalError<bool>($"Error syncing tenant permissions from plan: {ex.Message}");
            }
        }
    }
}
