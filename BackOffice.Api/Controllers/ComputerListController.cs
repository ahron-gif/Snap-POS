using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ComputerListController : ControllerBase
    {
        private readonly IComputerListService _computerListService;

        public ComputerListController(IComputerListService computerListService)
        {
            _computerListService = computerListService;
        }

        /// <summary>
        /// Gets all computers with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of computers</returns>
        [HttpGet("GetAllComputers")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _computerListService.GetAllComputersGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
