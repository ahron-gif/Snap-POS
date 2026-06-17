using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TransferItemsListController : ControllerBase
    {
        private readonly ITransferItemsListService _transferItemsListService;

        public TransferItemsListController(ITransferItemsListService transferItemsListService)
        {
            _transferItemsListService = transferItemsListService;
        }

        /// <summary>
        /// Gets all transfers with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of transfers</returns>
        [HttpGet("GetAllTransfers")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _transferItemsListService.GetAllTransfersGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
