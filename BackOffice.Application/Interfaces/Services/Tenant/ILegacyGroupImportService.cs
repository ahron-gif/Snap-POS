using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.GroupImport;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    /// <summary>
    /// Imports legacy desktop user security groups (tenant <c>Groups</c> table) into the web RBAC
    /// roles (<c>RbacTenantRoles</c>). Operates on whichever tenant DB the current request is bound
    /// to (Super Admin selects the tenant via the CustomerId header). Mirrors the Label Import flow.
    /// </summary>
    public interface ILegacyGroupImportService
    {
        /// <summary>Paginated/sorted/searched legacy-group previews for the shared ServerGrid.</summary>
        Task<ApiResponse<PaginationResponseDTO<LegacyGroupPreviewDto>>> GetLegacyGroupsPagedAsync(PaginationGridDto grid);

        /// <summary>
        /// Converts the requested groups (or all, when none specified) and inserts/updates them in
        /// <c>RbacTenantRoles</c>. Returns a per-group report. The legacy <c>Groups</c> table is
        /// never modified.
        /// </summary>
        Task<ApiResponse<LegacyGroupImportResultDto>> ImportAsync(LegacyGroupImportRequestDto request, int? userId);
    }
}
