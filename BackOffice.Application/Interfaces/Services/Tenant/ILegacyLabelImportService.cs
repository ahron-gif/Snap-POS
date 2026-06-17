using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.LabelTemplate;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    /// <summary>
    /// Imports legacy desktop label layouts (tenant <c>PrintLabelLayout</c> table) into the web
    /// Label Designer (<c>LabelTemplates</c>). Operates on whichever tenant DB the current request
    /// is bound to (Super Admin selects the tenant via the CustomerId header).
    /// </summary>
    public interface ILegacyLabelImportService
    {
        /// <summary>
        /// Reads the tenant's <c>PrintLabelLayout</c> rows and returns a converted preview of each
        /// (geometry, element count, warnings, and whether a same-named template already exists).
        /// Nothing is written.
        /// </summary>
        Task<ApiResponse<List<LegacyLayoutPreviewDto>>> GetLegacyLayoutsAsync();

        /// <summary>
        /// Paginated/sorted/searched variant of <see cref="GetLegacyLayoutsAsync"/> for the
        /// shared ServerGrid. Returns a page of converted previews plus total/filtered counts.
        /// </summary>
        Task<ApiResponse<PaginationResponseDTO<LegacyLayoutPreviewDto>>> GetLegacyLayoutsPagedAsync(PaginationGridDto grid);

        /// <summary>
        /// Converts the requested legacy layouts (or all, when none specified) and inserts/updates
        /// them in <c>LabelTemplates</c>. Returns a per-layout report. <c>PrintLabelLayout</c> is
        /// never modified, so the desktop app keeps working.
        /// </summary>
        Task<ApiResponse<LegacyLabelImportResultDto>> ImportAsync(LegacyLabelImportRequestDto request, Guid? userId);
    }
}
