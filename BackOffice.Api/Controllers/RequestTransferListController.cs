using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RequestTransferListController : ControllerBase
    {
        private readonly IRequestTransferListService _requestTransferListService;

        public RequestTransferListController(IRequestTransferListService requestTransferListService)
        {
            _requestTransferListService = requestTransferListService;
        }

        /// <summary>
        /// Gets all request transfers with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of request transfers</returns>
        [HttpGet("GetAllRequestTransfers")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _requestTransferListService.GetAllRequestTransfersGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
