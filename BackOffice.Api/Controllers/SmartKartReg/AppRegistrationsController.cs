using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.ApplicationRegistration;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers.SmartKartReg
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AppRegistrationsController : ControllerBase
    {
        private readonly IAppRegistrationService _appRegistrationService;

        public AppRegistrationsController(IAppRegistrationService appRegistrationService)
        {
            _appRegistrationService = appRegistrationService;
        }

        /// <summary>
        /// Get all application registrations with pagination, filtering, and sorting
        /// </summary>
        [HttpGet]
        public IActionResult GetAllAppRegistrations([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _appRegistrationService.GetAllAppRegistrationsGrid(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get application registration by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAppRegistration(Guid id)
        {
            var result = await _appRegistrationService.GetAppRegistrationByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new application registration
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateAppRegistration([FromBody] CreateAppRegistrationDto dto)
        {
            var result = await _appRegistrationService.CreateAppRegistrationAsync(dto);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing application registration
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAppRegistration(Guid id, [FromBody] UpdateAppRegistrationDto dto)
        {
            if (id != dto.Id)
            {
                return BadRequest("ID mismatch");
            }

            var result = await _appRegistrationService.UpdateAppRegistrationAsync(dto);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete an application registration
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAppRegistration(Guid id)
        {
            var result = await _appRegistrationService.DeleteAppRegistrationAsync(id);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }
    }
}
