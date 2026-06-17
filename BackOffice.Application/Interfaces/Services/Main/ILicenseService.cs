using BackOffice.Application.DTOs.Mian.License;

namespace BackOffice.Application.Interfaces.Services.Main
{
    /// <summary>
    /// SuperAdmin-only service that reads / writes the per-tenant license
    /// blob — the encrypted XML in <c>EncData.EncData</c> on each tenant DB.
    /// Mirrors the desktop FrmStartWz "RDT Systems Installation Setup" form.
    /// </summary>
    public interface ILicenseService
    {
        /// <summary>
        /// Loads the global (Type IS NULL) EncData row for the given tenant,
        /// decrypts it, and returns the strongly-typed view. Returns
        /// <c>null</c> if the tenant DB has no EncData row yet.
        /// </summary>
        Task<LicenseDto?> GetLicenseAsync(int customerId, CancellationToken ct = default);

        /// <summary>
        /// Updates the global EncData row. Loads the existing decrypted XML
        /// first (preserves any unknown / legacy fields that the DTO doesn't
        /// surface), overlays the DTO values, re-encrypts, and saves via
        /// SP_SetEncData. Throws if the tenant cannot be reached.
        /// </summary>
        Task UpdateLicenseAsync(int customerId, LicenseDto dto, CancellationToken ct = default);
    }
}
