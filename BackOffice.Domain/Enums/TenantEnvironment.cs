namespace BackOffice.Domain.Enums
{
    /// <summary>
    /// Indicates which environment a master customer (tenant) belongs to.
    /// </summary>
    public enum TenantEnvironment
    {
        /// <summary>
        /// Live, production tenant.
        /// </summary>
        Production = 1,

        /// <summary>
        /// Non‑production tenant (test, staging, demo, etc.).
        /// </summary>
        NonProduction = 2,
    }
}

