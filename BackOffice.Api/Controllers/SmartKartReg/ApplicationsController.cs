using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.Application;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers.SmartKartReg
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ApplicationsController : ControllerBase
    {
        private readonly IApplicationService _applicationService;

        public ApplicationsController(IApplicationService applicationService)
        {
            _applicationService = applicationService;
        }

        /// <summary>
        /// Get all applications with pagination, filtering, and sorting
        /// </summary>
        [HttpGet]
        public IActionResult GetAllApplications([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _applicationService.GetAllApplicationsGrid(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get lightweight application list for dropdowns (AppId, AppName)
        /// </summary>
        [HttpGet("dropdown")]
        public async Task<IActionResult> GetApplicationsDropdown()
        {
            var result = await _applicationService.GetApplicationsDropdownAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get application by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetApplication(Guid id)
        {
            var result = await _applicationService.GetApplicationByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new application
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateApplication([FromBody] CreateApplicationDto dto)
        {
            var result = await _applicationService.CreateApplicationAsync(dto);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing application
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateApplication(Guid id, [FromBody] UpdateApplicationDto dto)
        {
            if (id != dto.AppId)
            {
                return BadRequest("ID mismatch");
            }

            var result = await _applicationService.UpdateApplicationAsync(dto);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete an application
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteApplication(Guid id)
        {
            var result = await _applicationService.DeleteApplicationAsync(id);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }
    }
}
