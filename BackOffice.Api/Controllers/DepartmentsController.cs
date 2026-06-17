using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Department;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DepartmentsController : ControllerBase
    {
        private readonly IDepartmentService _departmentService;

        public DepartmentsController(IDepartmentService departmentService)
        {
            _departmentService = departmentService;
        }

        /// <summary>
        /// Get all departments for tree grid display
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllDepartments()
        {
            var result = await _departmentService.GetAllDepartmentsAsync();
            return Ok(result);
        }

        /// <summary>
        /// Gets all departments with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of departments</returns>
        [HttpGet("GetAllDepartments")]
        public IActionResult GetAllDepartmentsGrid([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _departmentService.GetAllDepartmentsGridAsync(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get department by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetDepartment(Guid id)
        {
            var result = await _departmentService.GetDepartmentByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new department
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateDepartment([FromBody] CreateDepartmentDto dto)
        {
            // Get modifier ID from JWT claims
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _departmentService.CreateDepartmentAsync(dto, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing department
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDepartment(Guid id, [FromBody] UpdateDepartmentDto dto)
        {
            if (id != dto.DepartmentStoreID)
            {
                return BadRequest("ID mismatch");
            }

            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _departmentService.UpdateDepartmentAsync(dto, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete a department
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDepartment(Guid id)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            // First check if can delete
            var canDelete = await _departmentService.CanDeleteDepartmentAsync(id);
            if (!canDelete.Response)
            {
                return BadRequest(canDelete);
            }

            var result = await _departmentService.DeleteDepartmentAsync(id, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Check if department can be deleted (no items attached)
        /// </summary>
        [HttpGet("{id}/can-delete")]
        public async Task<IActionResult> CanDeleteDepartment(Guid id)
        {
            var result = await _departmentService.CanDeleteDepartmentAsync(id);
            return Ok(result);
        }

        /// <summary>
        /// Check if department name exists
        /// </summary>
        [HttpGet("name-exists")]
        public async Task<IActionResult> DepartmentNameExists([FromQuery] string name, [FromQuery] Guid? excludeId = null)
        {
            var result = await _departmentService.DepartmentNameExistsAsync(name, excludeId);
            return Ok(result);
        }

        private Guid GetUserIdFromClaims()
        {
            // JWT claims use "LocalUserId" (tenant-level GUID) and "UserId" (global INT)
            // Must match exact casing — claims are case-sensitive
            var userIdClaim = User.FindFirst("LocalUserId")?.Value
                              ?? User.FindFirst("UserId")?.Value
                              ?? User.FindFirst("userId")?.Value
                              ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (Guid.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }
            return Guid.Empty;
        }
    }
}
