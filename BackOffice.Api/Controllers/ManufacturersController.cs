using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Manufacturer;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ManufacturersController : ControllerBase
    {
        private readonly IManufacturerService _manufacturerService;

        public ManufacturersController(IManufacturerService manufacturerService)
        {
            _manufacturerService = manufacturerService;
        }

        /// <summary>
        /// Get all manufacturers for grid display
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllManufacturers()
        {
            var result = await _manufacturerService.GetAllManufacturersAsync();
            return Ok(result);
        }

        /// <summary>
        /// Gets all manufacturers with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of manufacturers</returns>
        [HttpGet("GetAllManufacturers")]
        public IActionResult GetAllManufacturersGrid([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _manufacturerService.GetAllManufacturersGridAsync(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get manufacturer by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetManufacturer(Guid id)
        {
            var result = await _manufacturerService.GetManufacturerByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new manufacturer
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateManufacturer([FromBody] CreateManufacturerDto dto)
        {
            // Get modifier ID from JWT claims
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _manufacturerService.CreateManufacturerAsync(dto, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing manufacturer
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateManufacturer(Guid id, [FromBody] UpdateManufacturerDto dto)
        {
            if (id != dto.ManufacturerID)
            {
                return BadRequest("ID mismatch");
            }

            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _manufacturerService.UpdateManufacturerAsync(dto, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete a manufacturer
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteManufacturer(Guid id)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            // First check if can delete
            var canDelete = await _manufacturerService.CanDeleteManufacturerAsync(id);
            if (!canDelete.Response)
            {
                return BadRequest(canDelete);
            }

            var result = await _manufacturerService.DeleteManufacturerAsync(id, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Check if manufacturer can be deleted (no items attached)
        /// </summary>
        [HttpGet("{id}/can-delete")]
        public async Task<IActionResult> CanDeleteManufacturer(Guid id)
        {
            var result = await _manufacturerService.CanDeleteManufacturerAsync(id);
            return Ok(result);
        }

        /// <summary>
        /// Check if manufacturer name exists
        /// </summary>
        [HttpGet("name-exists")]
        public async Task<IActionResult> ManufacturerNameExists([FromQuery] string name, [FromQuery] Guid? excludeId = null)
        {
            var result = await _manufacturerService.ManufacturerNameExistsAsync(name, excludeId);
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
