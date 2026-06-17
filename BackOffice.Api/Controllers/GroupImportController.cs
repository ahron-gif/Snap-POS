using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.GroupImport;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Super-Admin endpoints for migrating legacy desktop user security groups (tenant
    /// <c>Groups</c> table) into the web RBAC roles (<c>RbacTenantRoles</c>).
    ///
    /// The target tenant is selected the same way as other Super-Admin tenant-scoped calls:
    /// the request carries a <c>CustomerId</c> header which <c>TenantConnectionMiddleware</c>
    /// uses to bind <c>TenantDBContext</c> to that tenant's database. The caller's own
    /// <c>CustomerId</c> claim must be empty/0 (i.e. a Super Admin).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GroupImportController : ControllerBase
    {
        private readonly ILegacyGroupImportService _importService;

        public GroupImportController(ILegacyGroupImportService importService)
        {
            _importService = importService;
        }

        /// <summary>
        /// Paginated/sorted/searched legacy-group previews for the shared ServerGrid.
        /// </summary>
        [HttpGet("legacy-groups/paged")]
        public async Task<IActionResult> GetLegacyGroupsPaged([FromQuery] PaginationGridDto grid)
        {
            if (!IsSuperAdmin()) return Forbid();

            var result = await _importService.GetLegacyGroupsPagedAsync(grid ?? new PaginationGridDto());
            return Ok(result);
        }

        /// <summary>
        /// Imports the requested legacy groups (or all, when none specified) into the selected
        /// tenant's <c>RbacTenantRoles</c>. Returns a per-group report.
        /// </summary>
        [HttpPost("import")]
        public async Task<IActionResult> Import([FromBody] LegacyGroupImportRequestDto request)
        {
            if (!IsSuperAdmin()) return Forbid();

            var result = await _importService.ImportAsync(request ?? new LegacyGroupImportRequestDto(), GetUserId());
            return Ok(result);
        }

        private bool IsSuperAdmin()
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            return string.IsNullOrEmpty(customerIdClaim) || customerIdClaim == "0";
        }

        private int? GetUserId()
        {
            var claim = User.FindFirst("UserId");
            return claim != null && int.TryParse(claim.Value, out var id) ? id : null;
        }
    }
}
