using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ItemDetailsOnPhoneOrderController : ControllerBase
    {
        private readonly IItemDetailsOnPhoneOrderService _service;

        public ItemDetailsOnPhoneOrderController(IItemDetailsOnPhoneOrderService service)
        {
            _service = service;
        }

        [HttpGet("GetItemDetailsOnPhoneOrder")]
        public async Task<IActionResult> GetAll(
            [FromQuery] PaginationGridDto paginationGridDto,
            [FromQuery] string? phoneStatus,
            [FromQuery] string? itemStoreId)
        {
            var result = await _service.GetItemDetailsOnPhoneOrderAsync(paginationGridDto, phoneStatus, itemStoreId);
            return Ok(result);
        }
    }
}
