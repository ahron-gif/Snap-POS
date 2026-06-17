using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ReceiveTransferListController : ControllerBase
    {
        private readonly IReceiveTransferListService _receiveTransferListService;

        public ReceiveTransferListController(IReceiveTransferListService receiveTransferListService)
        {
            _receiveTransferListService = receiveTransferListService;
        }

        /// <summary>
        /// Gets all receive transfers with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of receive transfers</returns>
        [HttpGet("GetAllReceiveTransfers")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _receiveTransferListService.GetAllReceiveTransfersGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
