using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ItemOnPhoneOrderController : ControllerBase
    {
        private readonly IItemOnPhoneOrderService _service;

        public ItemOnPhoneOrderController(IItemOnPhoneOrderService service)
        {
            _service = service;
        }

        [HttpGet("GetItemsOnPhoneOrder")]
        public async Task<IActionResult> GetAll(
            [FromQuery] PaginationGridDto paginationGridDto,
            [FromQuery] string? phoneStatus,
            [FromQuery] bool aggregated = false)
        {
            var result = await _service.GetItemsOnPhoneOrderAsync(paginationGridDto, phoneStatus, aggregated);
            return Ok(result);
        }
    }
}
