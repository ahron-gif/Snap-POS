using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Supplier;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SupplierController : ControllerBase
    {
        private readonly ISupplierService _supplierService;

        public SupplierController(ISupplierService supplierService)
        {
            _supplierService = supplierService;
        }

        /// <summary>
        /// Gets all suppliers with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of suppliers</returns>
        [HttpGet("GetAllSuppliers")]
        public IActionResult GetAllSuppliersGrid([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _supplierService.GetAllSuppliersGridAsync(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get supplier by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetSupplier(Guid id)
        {
            var result = await _supplierService.GetSupplierByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new supplier
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateSupplier([FromBody] CreateSupplierDto dto)
        {
            var creatorId = GetUserIdFromClaims();
            if (creatorId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _supplierService.CreateSupplierAsync(dto, creatorId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing supplier
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSupplier(Guid id, [FromBody] UpdateSupplierDto dto)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _supplierService.UpdateSupplierAsync(id, dto, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Toggle supplier status (active/inactive)
        /// </summary>
        [HttpPut("{id}/toggle-status")]
        public async Task<IActionResult> ToggleSupplierStatus(Guid id)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _supplierService.ToggleSupplierStatusAsync(id, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete a supplier (soft delete)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupplier(Guid id)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _supplierService.DeleteSupplierAsync(id, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Get supplier notes
        /// </summary>
        [HttpGet("{id}/notes")]
        public async Task<IActionResult> GetSupplierNotes(Guid id)
        {
            var result = await _supplierService.GetSupplierNotesAsync(id);
            return Ok(result);
        }

        /// <summary>
        /// Add a note to a supplier
        /// </summary>
        [HttpPost("{id}/notes")]
        public async Task<IActionResult> AddSupplierNote(Guid id, [FromBody] CreateSupplierNoteDto dto)
        {
            var creatorId = GetUserIdFromClaims();
            if (creatorId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _supplierService.AddSupplierNoteAsync(id, dto, creatorId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete a supplier note
        /// </summary>
        [HttpDelete("{id}/notes/{noteId}")]
        public async Task<IActionResult> DeleteSupplierNote(Guid id, Guid noteId)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _supplierService.DeleteSupplierNoteAsync(id, noteId, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Get supplier items
        /// </summary>
        [HttpGet("{id}/items")]
        public async Task<IActionResult> GetSupplierItems(Guid id, [FromQuery] bool includeInactive = false)
        {
            var result = await _supplierService.GetSupplierItemsAsync(id, includeInactive);
            return Ok(result);
        }

        /// <summary>
        /// Get supplier history (Open PO, balances, MTD, PTD, YTD)
        /// </summary>
        [HttpGet("{id}/history")]
        public async Task<IActionResult> GetSupplierHistory(Guid id)
        {
            var result = await _supplierService.GetSupplierHistoryAsync(id);
            return Ok(result);
        }

        private Guid GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("LocalUserId")?.Value
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
