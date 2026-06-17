using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.Permission;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers.SmartKartReg
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PermissionsController : ControllerBase
    {
        private readonly IPermissionService _permissionService;

        public PermissionsController(IPermissionService permissionService)
        {
            _permissionService = permissionService;
        }

        /// <summary>
        /// Get all permissions with pagination, filtering, and sorting
        /// </summary>
        [HttpGet]
        public IActionResult GetAllPermissions([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _permissionService.GetAllPermissionsGrid(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get permission by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetPermission(int id)
        {
            var result = await _permissionService.GetPermissionByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new permission
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreatePermission([FromBody] CreatePermissionDto dto)
        {
            var createdBy = GetUserNameFromClaims();
            var result = await _permissionService.CreatePermissionAsync(dto, createdBy);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing permission
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePermission(int id, [FromBody] UpdatePermissionDto dto)
        {
            if (id != dto.Id)
            {
                return BadRequest("ID mismatch");
            }

            var modifiedBy = GetUserNameFromClaims();
            var result = await _permissionService.UpdatePermissionAsync(dto, modifiedBy);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete a permission
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePermission(int id)
        {
            var result = await _permissionService.DeletePermissionAsync(id);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Check if a permission key already exists
        /// </summary>
        [HttpGet("key-exists")]
        public async Task<IActionResult> PermissionKeyExists([FromQuery] string key, [FromQuery] int? excludeId = null)
        {
            var result = await _permissionService.PermissionKeyExistsAsync(key, excludeId);
            return Ok(result);
        }

        private string GetUserNameFromClaims()
        {
            return User.FindFirst("userId")?.Value
                   ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                   ?? "System";
        }
    }
}
