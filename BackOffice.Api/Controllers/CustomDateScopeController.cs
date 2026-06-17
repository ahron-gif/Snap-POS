using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Reports;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// CRUD for tenant-defined Custom Date Scopes (named filter presets used
    /// by the Reports "More" dropdown). Permissions are gated by Tenant
    /// Feature Access (super-admin grants reports.setup.custom_date_scope.*).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CustomDateScopeController : ControllerBase
    {
        private readonly ICustomDateScopeService _service;

        public CustomDateScopeController(ICustomDateScopeService service)
        {
            _service = service;
        }

        [HttpGet]
        [RequirePermission("reports.setup.custom_date_scope.view")]
        public IActionResult GetPaged([FromQuery] PaginationGridDto grid)
        {
            var result = _service.GetPagedAsync(grid);
            return Ok(result);
        }

        [HttpGet("active")]
        [RequirePermission("reports.setup.custom_date_scope.view")]
        public async Task<IActionResult> GetActive()
        {
            var result = await _service.GetActiveAsync();
            return Ok(result);
        }

        [HttpGet("{id:guid}")]
        [RequirePermission("reports.setup.custom_date_scope.view")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var result = await _service.GetByIdAsync(id);
            if (!result.IsSuccess) return NotFound(result);
            return Ok(result);
        }

        [HttpPost]
        [RequirePermission("reports.setup.custom_date_scope.create")]
        public async Task<IActionResult> Create([FromBody] CreateCustomDateScopeDto dto)
        {
            var userId = GetUserIdFromClaims();
            var result = await _service.CreateAsync(dto, userId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("{id:guid}")]
        [RequirePermission("reports.setup.custom_date_scope.edit")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomDateScopeDto dto)
        {
            if (id != dto.CustomDateScopeID)
                return BadRequest("ID mismatch.");

            var userId = GetUserIdFromClaims();
            var result = await _service.UpdateAsync(id, dto, userId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("{id:guid}")]
        [RequirePermission("reports.setup.custom_date_scope.delete")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var userId = GetUserIdFromClaims();
            var result = await _service.DeleteAsync(id, userId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Soft-deletes a batch of scopes in a single transaction. The
        /// service re-compacts SortOrder so the surviving active rows stay
        /// 1..N contiguous. Body: a JSON array of GUIDs.
        /// </summary>
        [HttpDelete("bulk")]
        [RequirePermission("reports.setup.custom_date_scope.delete")]
        public async Task<IActionResult> BulkDelete([FromBody] List<Guid> ids)
        {
            var userId = GetUserIdFromClaims();
            var result = await _service.BulkDeleteAsync(ids, userId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        private Guid GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("LocalUserId")?.Value
                              ?? User.FindFirst("UserId")?.Value
                              ?? User.FindFirst("userId")?.Value
                              ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdClaim, out var id) ? id : Guid.Empty;
        }
    }
}
