using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.Registration;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers.SmartKartReg
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RegistrationsController : ControllerBase
    {
        private readonly IRegistrationService _registrationService;

        public RegistrationsController(IRegistrationService registrationService)
        {
            _registrationService = registrationService;
        }

        /// <summary>
        /// Get all registrations (customers) with pagination, filtering, and sorting
        /// </summary>
        [HttpGet]
        public IActionResult GetAllRegistrations([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _registrationService.GetAllRegistrationsGrid(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get registration by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetRegistration(Guid id)
        {
            var result = await _registrationService.GetRegistrationByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new registration (customer)
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateRegistration([FromBody] CreateRegistrationDto dto)
        {
            var result = await _registrationService.CreateRegistrationAsync(dto);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing registration (customer)
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRegistration(Guid id, [FromBody] UpdateRegistrationDto dto)
        {
            if (id != dto.RegistrationId)
            {
                return BadRequest("ID mismatch");
            }

            var result = await _registrationService.UpdateRegistrationAsync(dto);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Soft delete a registration (customer) - sets Status to 2
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRegistration(Guid id)
        {
            var result = await _registrationService.DeleteRegistrationAsync(id);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }
    }
}
