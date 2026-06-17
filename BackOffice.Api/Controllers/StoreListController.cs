using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class StoreListController : ControllerBase
    {
        private readonly IStoreListService _storeListService;

        public StoreListController(IStoreListService storeListService)
        {
            _storeListService = storeListService;
        }

        /// <summary>
        /// Gets all stores with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of stores</returns>
        [HttpGet("GetAllStores")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _storeListService.GetAllStoresGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
