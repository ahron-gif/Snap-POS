using BackOffice.Application.DTOs.Tenant.GridColumnAccess;
using BackOffice.Common;
using System;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    /// <summary>
    /// Service interface for managing Super-Admin-defined per-user column visibility rules on grids.
    /// </summary>
    public interface IGridColumnAccessService
    {
        /// <summary>
        /// Gets the raw column-access rules stored for a single user on a grid.
        /// Does NOT merge with tenant defaults — use this for admin edit screens
        /// where we want to show exactly what the admin saved for that user.
        ///
        /// Pass <see cref="Guid.Empty"/> as userId to read/write the tenant-wide
        /// default rules (the "all users" settings).
        ///
        /// Returns an empty list if no rules exist.
        /// </summary>
        Task<ApiResult<GridColumnAccessResponseDto>> GetForUserAndGridAsync(Guid userId, string gridId);

        /// <summary>
        /// Gets the EFFECTIVE column-access rules for a user on a grid, with
        /// tenant defaults overlaid by any user-specific overrides. This is what
        /// the runtime filter should consume.
        ///
        /// Precedence: user-specific rule for field X wins; otherwise tenant
        /// default for field X applies; otherwise the column is allowed.
        /// </summary>
        Task<ApiResult<GridColumnAccessResponseDto>> GetEffectiveForUserAsync(Guid userId, string gridId);

        /// <summary>
        /// Upserts the full column-access set for a user on a grid in a single
        /// transactional operation. Any existing rules not present in
        /// <paramref name="dto"/> are removed.
        /// </summary>
        /// <param name="modifiedBy">UserId of the Super Admin performing the change.</param>
        Task<ApiResult<bool>> SaveAsync(SaveGridColumnAccessDto dto, Guid modifiedBy);

        /// <summary>
        /// Deletes all column-access rules for a user on a grid (resets to "all visible").
        /// </summary>
        Task<ApiResult<bool>> ResetForUserAndGridAsync(Guid userId, string gridId);

        /// <summary>
        /// Returns a lightweight "version token" — the max DateModified across
        /// every row that affects the given user on the given grid (the user's
        /// own overrides AND the tenant default rows). Used by the frontend
        /// visibility-change refresh to decide whether to re-pull the full
        /// effective payload.
        ///
        /// Response is null when there are no rules at all for this grid.
        /// </summary>
        Task<ApiResult<DateTime?>> GetVersionForUserAsync(Guid userId, string gridId);

        /// <summary>
        /// Gets the GLOBAL, cross-tenant default column config for a grid. This
        /// lives in the MAIN (master) database — not any tenant DB — and is the
        /// baseline applied to every tenant that has not saved its own config.
        ///
        /// Returns an empty list if no global default has been saved.
        /// </summary>
        Task<ApiResult<GridColumnAccessResponseDto>> GetDefaultAsync(string gridId);

        /// <summary>
        /// Upserts the GLOBAL, cross-tenant default column config for a grid in
        /// the MAIN database (wipe-and-insert for the grid). <c>dto.UserId</c> is
        /// ignored — the global default has no user or tenant key.
        /// </summary>
        /// <param name="modifiedBy">UserId of the Super Admin performing the change.</param>
        Task<ApiResult<bool>> SaveDefaultAsync(SaveGridColumnAccessDto dto, Guid modifiedBy);

        /// <summary>
        /// Deletes the GLOBAL, cross-tenant default column config for a grid from
        /// the MAIN database (reverts tenants that inherit it to page defaults).
        /// </summary>
        Task<ApiResult<bool>> ResetDefaultAsync(string gridId);
    }
}
