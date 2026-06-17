using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ReplacedItemController : ControllerBase
    {
        private readonly IReplacedItemService _service;

        public ReplacedItemController(IReplacedItemService service)
        {
            _service = service;
        }

        [HttpGet("GetReplacedItems")]
        public async Task<IActionResult> GetAll(
            [FromQuery] PaginationGridDto paginationGridDto,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            var result = await _service.GetReplacedItemsAsync(paginationGridDto, fromDate, toDate);
            return Ok(result);
        }
    }
}
