namespace BackOffice.Application.Constants
{
    /// <summary>
    /// Standard operational roles that every tenant should have. These are seeded
    /// automatically during onboarding (see ITenantRbacService.SeedDefaultRolesAsync,
    /// called from InitializeAdminRoleAsync) and can be backfilled into existing
    /// tenants by re-running the seeder.
    ///
    /// Roles are created EMPTY (no permission grants) and as normal, tenant-editable
    /// roles (IsSystemRole = false) — the tenant admin assigns permissions afterward.
    ///
    /// <see cref="Code"/> is the idempotency key (unique within a tenant's
    /// RbacTenantRoles, matched case-insensitively); seeding skips any Code that
    /// already exists, so it is safe to run repeatedly. To change the standard set,
    /// edit <see cref="All"/>. Names mirror the operations team's role list and can
    /// be renamed per-tenant in the UI without affecting matching (which is by Code).
    /// </summary>
    public static class DefaultTenantRoles
    {
        public sealed record DefaultRole(string Code, string Name, string Description);

        public static readonly IReadOnlyList<DefaultRole> All = new List<DefaultRole>
        {
            new("PACKER",        "PACKER",        "Standard role: Packer."),
            new("CASHIER",       "Cashier",       "Standard role: Cashier."),
            new("PICKER",        "PICKER",        "Standard role: Picker."),
            new("STORE",         "Store",         "Standard role: Store."),
            new("DRIVERS",       "Drivers",       "Standard role: Drivers."),
            new("SALEASSOCIATE", "SALEASSOCIATE", "Standard role: Sale Associate."),
            new("SALES",         "SALES",         "Standard role: Sales."),
            new("BUYERS",        "BUYERS",        "Standard role: Buyers."),
        };
    }
}
