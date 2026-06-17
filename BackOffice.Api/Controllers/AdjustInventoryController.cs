using BackOffice.Application.DTOs.Tenant.AdjustInventory;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AdjustInventoryController : ControllerBase
    {
        //
        private readonly IAdjustInventoryService _adjustInventoryService;

        public AdjustInventoryController(IAdjustInventoryService adjustInventoryService)
        {
            _adjustInventoryService = adjustInventoryService;
        }

        /// <summary>
        /// Gets items for the Adjust Inventory grid with pagination and filtering.
        /// </summary>
        [HttpGet("GetItemsForAdjust")]
        public async Task<IActionResult> GetItemsForAdjust(
            [FromQuery] bool countedOnly = false,
            [FromQuery] bool discrepancyOnly = false,
            [FromQuery] Guid? storeId = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 100,
            [FromQuery] string? searchText = null)
        {
            var request = new GetItemsForAdjustRequestDto
            {
                CountedOnly = countedOnly,
                DiscrepancyOnly = discrepancyOnly,
                StoreId = storeId,
                ClearCount = false,
                ReverseQty = false,
                PageNumber = pageNumber,
                PageSize = pageSize,
                SearchText = searchText
            };

            var result = await _adjustInventoryService.GetItemsForAdjustAsync(request);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets items with reversed quantities (Change Qty to Minus).
        /// </summary>
        [HttpGet("GetItemsForAdjustReversed")]
        public async Task<IActionResult> GetItemsForAdjustReversed(
            [FromQuery] bool countedOnly = false,
            [FromQuery] bool discrepancyOnly = false,
            [FromQuery] Guid? storeId = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 100,
            [FromQuery] string? searchText = null)
        {
            var request = new GetItemsForAdjustRequestDto
            {
                CountedOnly = countedOnly,
                DiscrepancyOnly = discrepancyOnly,
                StoreId = storeId,
                ClearCount = false,
                ReverseQty = true,
                PageNumber = pageNumber,
                PageSize = pageSize,
                SearchText = searchText
            };

            var result = await _adjustInventoryService.GetItemsForAdjustAsync(request);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Saves a batch of inventory adjustments.
        /// </summary>
        [HttpPost("SaveAdjustments")]
        public async Task<IActionResult> SaveAdjustments([FromBody] SaveAdjustmentsRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var localUserIdClaim = User.FindFirst("LocalUserId");
            Guid userId = Guid.Empty;
            if (localUserIdClaim != null && Guid.TryParse(localUserIdClaim.Value, out var parsedUserId))

            {
                userId = parsedUserId;
            }

            var result = await _adjustInventoryService.SaveAdjustmentsAsync(request, userId);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Resets all physical counts for a store.
        /// </summary>
        [HttpPost("ResetPhysicalCount")]
        public async Task<IActionResult> ResetPhysicalCount([FromQuery] Guid storeId)
        {
            var result = await _adjustInventoryService.ResetPhysicalCountAsync(storeId);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets the Quick Report for a specific item showing all transactions within a date range.
        /// </summary>
        [HttpGet("QuickReport")]
        public async Task<IActionResult> GetQuickReport(
            [FromQuery] Guid itemStoreId,
            [FromQuery] DateTime startDate,
            [FromQuery] DateTime endDate,
            [FromQuery] Guid? itemId = null)
        {
            var request = new QuickReportRequestDto
            {
                ItemStoreID = itemStoreId,
                StartDate = startDate,
                EndDate = endDate,
                ItemID = itemId
            };

            var result = await _adjustInventoryService.GetQuickReportAsync(request);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets inventory levels for a specific item across all stores.
        /// </summary>
        [HttpGet("InventoryByStore")]
        public async Task<IActionResult> GetInventoryByStore([FromQuery] Guid itemId)
        {
            var result = await _adjustInventoryService.GetInventoryByStoreAsync(itemId);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
    }
}
