using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Discount;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DiscountListController : ControllerBase
    {
        private readonly IDiscountListService _discountListService;

        public DiscountListController(IDiscountListService discountListService)
        {
            _discountListService = discountListService;
        }

        /// <summary>
        /// gets all discounts with pageination, 
        /// Gets all discounts with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of discounts</returns>
        [HttpGet("GetAllDiscounts")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _discountListService.GetAllDiscountsGridAsync(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get discount by ID for view/edit form (includes related items, departments, brands, stores, tenders)
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetDiscount(Guid id)
        {
            var result = await _discountListService.GetDiscountByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new discount with related selections
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateDiscount([FromBody] CreateDiscountDto dto)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _discountListService.CreateDiscountAsync(dto, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing discount with related selections
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDiscount(Guid id, [FromBody] UpdateDiscountDto dto)
        {
            if (id != dto.DiscountID)
            {
                return BadRequest("ID mismatch");
            }

            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _discountListService.UpdateDiscountAsync(dto, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Check if a discount can be deleted
        /// </summary>
        [HttpGet("{id}/can-delete")]
        public async Task<IActionResult> CanDeleteDiscount(Guid id)
        {
            var result = await _discountListService.CanDeleteDiscountAsync(id);
            return Ok(result);
        }
        
        /// <summary>
        /// Delete a discount and its related data
        /// Delete a discount and its related data
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDiscount(Guid id)
        
        { 
            
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            // First check if can delete
            var canDelete = await _discountListService.CanDeleteDiscountAsync(id);
            if (!canDelete.Response)
            {
                return BadRequest(canDelete);
            }

            var result = await _discountListService.DeleteDiscountAsync(id, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        private Guid GetUserIdFromClaims()
        {
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
