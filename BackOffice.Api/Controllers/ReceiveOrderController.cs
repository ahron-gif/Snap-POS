using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ReceiveOrderController : ControllerBase
    {
        private readonly IReceiveOrderService _receiveOrderService;

        public ReceiveOrderController(IReceiveOrderService receiveOrderService)
        {
            _receiveOrderService = receiveOrderService;
        }

        /// <summary>
        /// Gets all receive orders with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of receive orders</returns>
        [HttpGet("GetAllReceiveOrders")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _receiveOrderService.GetAllReceiveOrdersGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
