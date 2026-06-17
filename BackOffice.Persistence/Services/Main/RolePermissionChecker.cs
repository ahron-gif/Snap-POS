using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    public class RolePermissionChecker : IRolePermissionChecker
    {
        private readonly MainDBContext _dbContext;
        private readonly IMemoryCache _cache;
        private readonly ILogger<RolePermissionChecker> _logger;
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

        public RolePermissionChecker(
            MainDBContext dbContext,
            IMemoryCache cache,
            ILogger<RolePermissionChecker> logger)
        {
            _dbContext = dbContext;
            _cache = cache;
            _logger = logger;
        }

        public async Task<bool> UserHasPermissionAsync(int userId, int? customerId, string modulePageUrl, string actionKey)
        {
            try
            {
                var cacheKey = $"UserPermissions_{userId}_{customerId}";

                if (!_cache.TryGetValue(cacheKey, out HashSet<string>? allowedPermissions))
                {
                    allowedPermissions = await BuildUserPermissionSetAsync(userId, customerId);
                    _cache.Set(cacheKey, allowedPermissions, CacheDuration);
                }

                var permissionKey = $"{modulePageUrl}:{actionKey}";
                return allowedPermissions?.Contains(permissionKey) == true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking permission for user {UserId}", userId);
                return true;
            }
        }

        public async Task<bool> CustomerHasModuleAccessAsync(int customerId, string modulePageUrl)
        {
            try
            {
                var cacheKey = $"CustomerModules_{customerId}";

                if (!_cache.TryGetValue(cacheKey, out HashSet<string>? allowedModules))
                {
                    allowedModules = await BuildCustomerModuleSetAsync(customerId);
                    _cache.Set(cacheKey, allowedModules, CacheDuration);
                }

                return allowedModules?.Contains(modulePageUrl) == true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking module access for customer {CustomerId}", customerId);
                return true;
            }
        }

        public void InvalidateUserCache(int userId)
        {
            _cache.Remove($"UserPermissions_{userId}_");
        }

        public void InvalidateCustomerCache(int customerId)
        {
            _cache.Remove($"CustomerModules_{customerId}");
        }

        private async Task<HashSet<string>> BuildUserPermissionSetAsync(int userId, int? customerId)
        {
            var userRoleIds = await _dbContext.AppUserGlobalRoles
                .Where(x => x.UserId == userId)
                .Select(x => x.GlobalRoleId)
                .ToListAsync();

            if (customerId.HasValue)
            {
                var customerRoleIds = await _dbContext.CustomerGlobalRoles
                    .Where(x => x.CustomerId == customerId.Value)
                    .Select(x => x.GlobalRoleId)
                    .ToListAsync();

                userRoleIds = userRoleIds.Union(customerRoleIds).Distinct().ToList();
            }

            if (userRoleIds.Count == 0)
                return new HashSet<string>();

            var permissions = await (from grsa in _dbContext.GlobalRoleScreenActions
                                    join sa in _dbContext.ScreenActions on grsa.ScreenActionId equals sa.ScreenActionId
                                    join m in _dbContext.Modules on sa.ModuleId equals m.ModuleId
                                    where userRoleIds.Contains(grsa.GlobalRoleId)
                                          && grsa.IsAllowed
                                          && sa.IsActive
                                    select new { m.PageURL, sa.ActionKey })
                                   .ToListAsync();

            return new HashSet<string>(permissions.Select(p => $"{p.PageURL}:{p.ActionKey}"));
        }

        private async Task<HashSet<string>> BuildCustomerModuleSetAsync(int customerId)
        {
            var customerRoleIds = await _dbContext.CustomerGlobalRoles
                .Where(x => x.CustomerId == customerId)
                .Select(x => x.GlobalRoleId)
                .ToListAsync();

            if (customerRoleIds.Count == 0)
                return new HashSet<string>();

            var moduleUrls = await (from grsa in _dbContext.GlobalRoleScreenActions
                                    join sa in _dbContext.ScreenActions on grsa.ScreenActionId equals sa.ScreenActionId
                                    join m in _dbContext.Modules on sa.ModuleId equals m.ModuleId
                                    where customerRoleIds.Contains(grsa.GlobalRoleId)
                                          && grsa.IsAllowed
                                          && sa.IsActive
                                    select m.PageURL)
                                   .Distinct()
                                   .ToListAsync();

            return new HashSet<string>(moduleUrls);
        }
    }
}
