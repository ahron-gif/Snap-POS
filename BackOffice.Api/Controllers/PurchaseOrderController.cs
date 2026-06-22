using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.PurchaseOrder;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PurchaseOrderController : ControllerBase
    {
        private readonly IPurchaseOrderService _purchaseOrderService;

        public PurchaseOrderController(IPurchaseOrderService purchaseOrderService)
        {
            _purchaseOrderService = purchaseOrderService;
        }

        [HttpGet("GetAllPurchaseOrders")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _purchaseOrderService.GetAllPurchaseOrdersGridAsync(paginationGridDto);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var result = await _purchaseOrderService.GetPurchaseOrderByIdAsync(id);
            if (!result.IsSuccess) return NotFound(result);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreatePurchaseOrderDto dto)
        {
            var creatorId = GetUserIdFromClaims();
            if (creatorId == Guid.Empty) return Unauthorized();
            var result = await _purchaseOrderService.CreatePurchaseOrderAsync(dto, creatorId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePurchaseOrderDto dto)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty) return Unauthorized();
            var result = await _purchaseOrderService.UpdatePurchaseOrderAsync(id, dto, modifierId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty) return Unauthorized();
            var result = await _purchaseOrderService.DeletePurchaseOrderAsync(id, modifierId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("{id}/approve")]
        public async Task<IActionResult> Approve(Guid id)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty) return Unauthorized();
            var result = await _purchaseOrderService.ApprovePurchaseOrderAsync(id, modifierId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("{id}/send")]
        public async Task<IActionResult> Send(Guid id)
        {
            var modifierId = GetUserIdFromClaims();
            if (modifierId == Guid.Empty) return Unauthorized();
            var result = await _purchaseOrderService.SendPurchaseOrderAsync(id, modifierId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        private Guid GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("LocalUserId")?.Value
                              ?? User.FindFirst("userId")?.Value
                              ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(userIdClaim, out var userId)) return userId;
            return Guid.Empty;
        }
    }
}
