using BackOffice.Application.DTOs.Tenant.Setup;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    /// <summary>
    /// Read-only tenant-wide setup info (StoreType, module flags) sourced
    /// from the per-tenant encrypted EncData blob. Cached aggressively per
    /// customer to avoid decrypting on every request.
    /// </summary>
    public interface ITenantSetupService
    {
        Task<TenantSetupDto> GetSetupAsync(int customerId, CancellationToken ct = default);

        /// <summary>
        /// Drop the cached entry for a customer. Called whenever the license
        /// is updated (via <c>LicenseService.UpdateLicenseAsync</c>) so the
        /// next read reflects the change.
        /// </summary>
        void InvalidateCache(int customerId);
    }
}
