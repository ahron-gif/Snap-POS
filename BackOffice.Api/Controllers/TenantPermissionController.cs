using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TenantPermissionController : ControllerBase
    {
        private readonly ITenantPermissionService _service;

        public TenantPermissionController(ITenantPermissionService service)
        {
            _service = service;
        }

        [HttpGet("{tenantId}/Ceiling")]
        public async Task<IActionResult> GetTenantCeiling(int tenantId)
        {
            var result = await _service.GetTenantCeilingAsync(tenantId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("{tenantId}/Modules")]
        public async Task<IActionResult> GetTenantAllowedModules(int tenantId)
        {
            var result = await _service.GetTenantAllowedModulesAsync(tenantId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Modules")]
        public async Task<IActionResult> UpdateTenantAllowedModules([FromBody] UpdateTenantAllowedModulesDto dto)
        {
            var grantedBy = GetUserIdFromClaims();
            var result = await _service.UpdateTenantAllowedModulesAsync(dto, grantedBy);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("{tenantId}/Permissions")]
        public async Task<IActionResult> GetTenantAllowedPermissions(int tenantId)
        {
            var result = await _service.GetTenantAllowedPermissionsAsync(tenantId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Permissions")]
        public async Task<IActionResult> UpdateTenantAllowedPermissions([FromBody] UpdateTenantAllowedPermissionsDto dto)
        {
            var grantedBy = GetUserIdFromClaims();
            var result = await _service.UpdateTenantAllowedPermissionsAsync(dto, grantedBy);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("{tenantId}/EnableAll")]
        public async Task<IActionResult> EnableAllPermissions(int tenantId)
        {
            var grantedBy = GetUserIdFromClaims();
            var result = await _service.EnableAllPermissionsForTenantAsync(tenantId, grantedBy);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("{tenantId}/SyncFromPlan")]
        public async Task<IActionResult> SyncFromPlan(int tenantId)
        {
            var result = await _service.SyncTenantPermissionsFromPlanAsync(tenantId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }
    }
}
