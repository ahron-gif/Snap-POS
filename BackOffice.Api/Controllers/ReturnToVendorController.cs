using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ReturnToVendorController : ControllerBase
    {
        private readonly IReturnToVendorService _returnToVendorService;

        public ReturnToVendorController(IReturnToVendorService returnToVendorService)
        {
            _returnToVendorService = returnToVendorService;
        }

        /// <summary>
        /// Gets all return to vendor records with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of return to vendor records</returns> 
        [HttpGet("GetAllReturnToVendors")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _returnToVendorService.GetAllReturnToVendorsGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
