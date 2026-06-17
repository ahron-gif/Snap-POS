using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;

namespace BackOffice.Persistence.Services.Main
{
    /// <summary>
    /// Builds effective permissions for a user in a tenant:
    ///   Effective = TenantCeiling INTERSECT (RolePerms MERGED WITH UserOverrides)
    ///
    /// Caching:
    ///   - Tenant ceiling:  key "tenant:{id}:ceiling"           TTL 5 min
    ///   - User perms:      key "tenant:{id}:user:{id}:perms"   TTL 5 min
    /// </summary>
    public class EffectivePermissionBuilder : IEffectivePermissionBuilder
    {
        private readonly MainDBContext _mainDb;
        private readonly TenantDBContext _tenantDb;
        private readonly IMemoryCache _cache;
        private readonly ILogger<EffectivePermissionBuilder> _logger;

        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

        public EffectivePermissionBuilder(
            MainDBContext mainDb,
            TenantDBContext tenantDb,
            IMemoryCache cache,
            ILogger<EffectivePermissionBuilder> logger)
        {
            _mainDb = mainDb;
            _tenantDb = tenantDb;
            _cache = cache;
            _logger = logger;
        }

        public async Task<EffectivePermissionResult> BuildEffectivePermissionsAsync(int userId, int tenantId)
        {
            var cacheKey = $"tenant:{tenantId}:user:{userId}:perms";

            if (_cache.TryGetValue(cacheKey, out EffectivePermissionResult? cached) && cached != null)
                return cached;

            try
            {
                // Super-admin short-circuit. They live outside the tenant model so the
                // role/ceiling chain below would resolve to an empty set for them.
                // Grant every active permission instead. Authoritative source is the
                // IsSuperAdmin flag (with the legacy CustomerId IS NULL fallback so
                // un-backfilled rows keep working).
                var isSuperAdmin = await _mainDb.WebAppUsers
                    .Where(u => u.UserId == userId)
                    .Select(u => u.IsSuperAdmin == true || u.CustomerId == null)
                    .FirstOrDefaultAsync();

                if (isSuperAdmin)
                {
                    var allKeys = await _mainDb.Permissions
                        .Where(p => p.IsActive)
                        .Select(p => p.PermissionKey)
                        .ToListAsync();

                    var allSet = new HashSet<string>(allKeys);
                    var superResult = new EffectivePermissionResult
                    {
                        Permissions = allSet,
                        VersionHash = ComputeVersionHash(allSet),
                        UserId = userId,
                        TenantId = tenantId
                    };
                    _cache.Set(cacheKey, superResult, CacheTtl);
                    return superResult;
                }

                // Step 1: Get tenant ceiling from Master DB (cached separately)
                var ceiling = await GetTenantCeilingCachedAsync(tenantId);

                // Step 2: Get user role-based permissions from Tenant DB
                var userRoleIds = await _tenantDb.RbacTenantUserRoles
                    .Where(x => x.UserId == userId)
                    .Select(x => x.RoleId)
                    .ToListAsync();

                var rolePerms = new HashSet<string>();
                if (userRoleIds.Count > 0)
                {
                    var grantedKeys = await _tenantDb.RbacTenantRolePermissions
                        .Where(x => userRoleIds.Contains(x.RoleId) && x.IsGranted)
                        .Select(x => x.PermissionKey)
                        .Distinct()
                        .ToListAsync();

                    rolePerms = new HashSet<string>(grantedKeys);
                }

                // Step 3: Get user overrides from Tenant DB (filter expired)
                var now = DateTime.UtcNow;
                var overrides = await _tenantDb.RbacTenantUserPermOverrides
                    .Where(x => x.UserId == userId &&
                                (x.ExpiresAt == null || x.ExpiresAt > now))
                    .ToListAsync();

                // Step 4: Merge role perms with overrides
                // Overrides take precedence: if IsGranted=true, add; if false, remove
                var merged = new HashSet<string>(rolePerms);
                foreach (var ov in overrides)
                {
                    if (ov.IsGranted)
                        merged.Add(ov.PermissionKey);
                    else
                        merged.Remove(ov.PermissionKey);
                }

                // Step 5: Effective = Ceiling INTERSECT Merged.
                // Tenant Feature Access (the previous Super-Admin per-user grant
                // mechanism) was removed; Custom Date Scope and other features
                // now flow through the standard role-based path above.
                // Step 5: Effective = Ceiling INTERSECT Merged
                merged.IntersectWith(ceiling);

                // Step 6: Compute version hash
                var versionHash = ComputeVersionHash(merged);

                var result = new EffectivePermissionResult
                {
                    Permissions = merged,
                    VersionHash = versionHash,
                    UserId = userId,
                    TenantId = tenantId
                };

                _cache.Set(cacheKey, result, CacheTtl);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error building effective permissions for user {UserId} in tenant {TenantId}", userId, tenantId);

                // Return empty permissions on error rather than crashing
                return new EffectivePermissionResult
                {
                    Permissions = new HashSet<string>(),
                    VersionHash = "error",
                    UserId = userId,
                    TenantId = tenantId
                };
            }
        }

        public async Task<string> GetPermissionVersionHashAsync(int userId, int tenantId)
        {
            var result = await BuildEffectivePermissionsAsync(userId, tenantId);
            return result.VersionHash;
        }

        public void InvalidateUserCache(int userId, int tenantId)
        {
            _cache.Remove($"tenant:{tenantId}:user:{userId}:perms");
        }

        public void InvalidateTenantCache(int tenantId)
        {
            // Remove tenant ceiling cache
            _cache.Remove($"tenant:{tenantId}:ceiling");

            // Note: IMemoryCache does not support pattern-based removal.
            // For a production system, consider using a cache with tag-based eviction
            // or maintaining a list of user IDs per tenant.
            // For now, the TTL (5 min) ensures stale caches expire naturally.
            // Callers should also call InvalidateUserCache for specific users when needed.
        }

        // ───────────────────────────────────────────────
        // Private Helpers
        // ───────────────────────────────────────────────

        private async Task<HashSet<string>> GetTenantCeilingCachedAsync(int tenantId)
        {
            var cacheKey = $"tenant:{tenantId}:ceiling";

            if (_cache.TryGetValue(cacheKey, out HashSet<string>? cached) && cached != null)
                return cached;

            var allowedPermissionIds = await _mainDb.TenantAllowedPermissions
                .Where(x => x.TenantId == tenantId && x.IsAllowed)
                .Select(x => x.PermissionId)
                .ToListAsync();

            var keys = await _mainDb.Permissions
                .Where(p => allowedPermissionIds.Contains(p.Id) && p.IsActive)
                .Select(p => p.PermissionKey)
                .ToListAsync();

            var ceiling = new HashSet<string>(keys);
            _cache.Set(cacheKey, ceiling, CacheTtl);

            return ceiling;
        }

        /// <summary>
        /// Computes a short SHA256-based hash of the sorted permission set.
        /// First 8 hex characters of the hash.
        /// </summary>
        private static string ComputeVersionHash(HashSet<string> permissions)
        {
            var sorted = permissions.OrderBy(x => x).ToList();
            var joined = string.Join("|", sorted);
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(joined));
            var hex = Convert.ToHexString(bytes);
            return hex[..8].ToLowerInvariant();
        }
    }
}
