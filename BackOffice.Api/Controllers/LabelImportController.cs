using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.LabelTemplate;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Super-Admin endpoints for migrating legacy desktop label layouts (tenant
    /// <c>PrintLabelLayout</c> table) into the web Label Designer (<c>LabelTemplates</c>).
    ///
    /// The target tenant is selected the same way as other Super-Admin tenant-scoped calls:
    /// the request carries a <c>CustomerId</c> header which <c>TenantConnectionMiddleware</c>
    /// uses to bind <c>TenantDBContext</c> to that tenant's database. The caller's own
    /// <c>CustomerId</c> claim must be empty/0 (i.e. a Super Admin).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class LabelImportController : ControllerBase
    {
        private readonly ILegacyLabelImportService _importService;

        public LabelImportController(ILegacyLabelImportService importService)
        {
            _importService = importService;
        }

        /// <summary>
        /// Lists the selected tenant's legacy layouts with a converted preview of each
        /// (geometry, element count, warnings, and whether a same-named template already exists).
        /// </summary>
        [HttpGet("legacy-layouts")]
        public async Task<IActionResult> GetLegacyLayouts()
        {
            if (!IsSuperAdmin()) return Forbid();

            var result = await _importService.GetLegacyLayoutsAsync();
            return Ok(result);
        }

        /// <summary>
        /// Paginated/sorted/searched legacy-layout previews for the shared ServerGrid.
        /// </summary>
        [HttpGet("legacy-layouts/paged")]
        public async Task<IActionResult> GetLegacyLayoutsPaged([FromQuery] PaginationGridDto grid)
        {
            if (!IsSuperAdmin()) return Forbid();

            var result = await _importService.GetLegacyLayoutsPagedAsync(grid ?? new PaginationGridDto());
            return Ok(result);
        }

        /// <summary>
        /// Imports the requested legacy layouts (or all, when none specified) into the selected
        /// tenant's <c>LabelTemplates</c>. Returns a per-layout report.
        /// </summary>
        [HttpPost("import")]
        public async Task<IActionResult> Import([FromBody] LegacyLabelImportRequestDto request)
        {
            if (!IsSuperAdmin()) return Forbid();

            var result = await _importService.ImportAsync(request ?? new LegacyLabelImportRequestDto(), GetUserId());
            return Ok(result);
        }

        /// <summary>
        /// Super Admins authenticate with no tenant context, so their <c>CustomerId</c> claim is
        /// absent or "0". The tenant being acted on is carried by the <c>CustomerId</c> header.
        /// </summary>
        private bool IsSuperAdmin()
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            return string.IsNullOrEmpty(customerIdClaim) || customerIdClaim == "0";
        }

        private Guid? GetUserId()
        {
            var claim = User.FindFirst("LocalUserId");
            return claim != null && Guid.TryParse(claim.Value, out var id) ? id : null;
        }
    }
}
