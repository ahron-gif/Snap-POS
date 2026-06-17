using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ApiDefinitionController : ControllerBase
    {
        private readonly IApiDefinitionService _apiDefinitionService;

        public ApiDefinitionController(IApiDefinitionService apiDefinitionService)
        {
            _apiDefinitionService = apiDefinitionService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllApiDefinitions()
        {
            var result = await _apiDefinitionService.GetAllApiDefinitionsAsync();
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateApiDefinition([FromBody] CreateApiDefinitionDto dto)
        {
            if (!IsSuperAdminFromToken())
                return Forbid();

            var result = await _apiDefinitionService.CreateApiDefinitionAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [Authorize]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateApiDefinition(int id, [FromBody] UpdateApiDefinitionDto dto)
        {
            if (!IsSuperAdminFromToken())
                return Forbid();

            if (id != dto.Id)
                return BadRequest("ID mismatch");

            var result = await _apiDefinitionService.UpdateApiDefinitionAsync(id, dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteApiDefinition(int id)
        {
            if (!IsSuperAdminFromToken())
                return Forbid();

            var result = await _apiDefinitionService.DeleteApiDefinitionAsync(id);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        // Default rate-per-call and free-tier are super-admin-only fields; the
        // frontend pricing page is gated by admin.api_pricing.edit. Match the
        // pattern used by NavigationController / CustomerCreditController.
        private bool IsSuperAdminFromToken()
        {
            var roleClaim = User.FindFirst("RoleType")?.Value;
            if (string.Equals(roleClaim, "SuperAdmin", StringComparison.OrdinalIgnoreCase))
                return true;
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            return string.IsNullOrEmpty(customerIdClaim) || customerIdClaim == "0";
        }
    }
}
