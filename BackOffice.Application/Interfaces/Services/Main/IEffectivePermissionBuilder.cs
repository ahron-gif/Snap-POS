using BackOffice.Application.DTOs.Main.PermissionManagement;

namespace BackOffice.Application.Interfaces.Services.Main
{
    /// <summary>
    /// Builds the effective permission set for a user within a tenant.
    /// Effective = TenantCeiling INTERSECT (RolePerms MERGED WITH UserOverrides)
    /// </summary>
    public interface IEffectivePermissionBuilder
    {
        /// <summary>
        /// Builds (or returns cached) effective permissions for the given user and tenant.
        /// </summary>
        Task<EffectivePermissionResult> BuildEffectivePermissionsAsync(int userId, int tenantId);

        /// <summary>
        /// Returns a short hash representing the current permission version for the user.
        /// </summary>
        Task<string> GetPermissionVersionHashAsync(int userId, int tenantId);

        /// <summary>
        /// Removes the cached effective permissions for a specific user in a tenant.
        /// </summary>
        void InvalidateUserCache(int userId, int tenantId);

        /// <summary>
        /// Removes the tenant ceiling cache and all user permission caches for the tenant.
        /// </summary>
        void InvalidateTenantCache(int tenantId);
    }
}
