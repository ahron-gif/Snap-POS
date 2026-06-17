using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RegisterListController : ControllerBase
    {
        private readonly IRegisterListService _registerListService;

        public RegisterListController(IRegisterListService registerListService)
        {
            _registerListService = registerListService;
        }

        /// <summary>
        /// Gets all registers with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of registers</returns>
        [HttpGet("GetAllRegisters")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _registerListService.GetAllRegistersGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
