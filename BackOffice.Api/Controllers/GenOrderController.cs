using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GenOrderController : ControllerBase
    {
        private readonly IGenOrderService _genOrderService;

        public GenOrderController(IGenOrderService genOrderService)
        {
            _genOrderService = genOrderService;
        }

        /// <summary>
        /// Gets all general order items with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of general order items</returns>
        [HttpGet("GetAllGenOrders")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _genOrderService.GetAllGenOrdersGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
