namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    /// <summary>
    /// The final effective permission set for a user in a tenant.
    /// Computed as: TenantCeiling INTERSECT (RolePerms MERGED WITH UserOverrides)
    /// </summary>
    public class EffectivePermissionResult
    {
        /// <summary>
        /// The set of permission keys the user effectively has.
        /// </summary>
        public HashSet<string> Permissions { get; set; } = new();

        /// <summary>
        /// A short hash representing the current version of the permissions.
        /// Used to detect changes (e.g. cached in JWT as "pv" claim).
        /// </summary>
        public string VersionHash { get; set; } = null!;

        public int UserId { get; set; }

        public int TenantId { get; set; }
    }
}
