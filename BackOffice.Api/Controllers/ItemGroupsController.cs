using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ItemGroup;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ItemGroupsController : ControllerBase
    {
        private readonly IItemGroupService _itemGroupService;

        public ItemGroupsController(IItemGroupService itemGroupService)
       
        {
            _itemGroupService = itemGroupService;
        }

        /// <summary>
        /// Get all item groups for tree grid display
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllItemGroups()
        {
            var result = await _itemGroupService.GetAllItemGroupsAsync();
            return Ok(result);
        }

        /// <summary>
        /// Gets all item groups with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of item groups</returns>
        [HttpGet("GetAllItemGroups")]
        public IActionResult GetAllItemGroupsGrid([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _itemGroupService.GetAllItemGroupsGridAsync(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get item group by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetItemGroup(Guid id)
        {
            var result = await _itemGroupService.GetItemGroupByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new item group
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateItemGroup([FromBody] CreateItemGroupDto dto)
        {
            // Get modifier ID from JWT claims
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _itemGroupService.CreateItemGroupAsync(dto, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing item group
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateItemGroup(Guid id, [FromBody] UpdateItemGroupDto dto)
        {
            if (id != dto.ItemGroupID)
            {
                return BadRequest("ID mismatch");
            }

            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            var result = await _itemGroupService.UpdateItemGroupAsync(dto, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete an item group
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteItemGroup(Guid id)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty)
            {
                return Unauthorized();
            }

            // First check if can delete
            var canDelete = await _itemGroupService.CanDeleteItemGroupAsync(id);
            if (!canDelete.Response)
            {
                return BadRequest(canDelete);
            }

            var result = await _itemGroupService.DeleteItemGroupAsync(id, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Check if item group can be deleted (no items attached)
        /// </summary>
        [HttpGet("{id}/can-delete")]
        public async Task<IActionResult> CanDeleteItemGroup(Guid id)
        {
            var result = await _itemGroupService.CanDeleteItemGroupAsync(id);
            return Ok(result);
        }

        /// <summary>
        /// Check if item group name exists
        /// </summary>
        [HttpGet("name-exists")]
        public async Task<IActionResult> ItemGroupNameExists([FromQuery] string name, [FromQuery] Guid? excludeId = null)
        {
            var result = await _itemGroupService.ItemGroupNameExistsAsync(name, excludeId);
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
