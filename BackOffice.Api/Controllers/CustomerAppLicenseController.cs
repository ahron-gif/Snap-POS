using BackOffice.Api.Authorization;
using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CustomerAppLicenseController : ControllerBase
    {
        private readonly ICustomerAppLicenseService _licenseService;

        public CustomerAppLicenseController(ICustomerAppLicenseService licenseService)
        {
            _licenseService = licenseService;
        }

        // --- Customer self-service ---

        [HttpGet("Mine")]
        [RequirePermission(Perms.Admin.LicensesBilling.View)]
        public async Task<IActionResult> GetMine([FromQuery] bool includeRemoved = false)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _licenseService.GetLicensesAsync(customerId, includeRemoved);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("MySummary")]
        [RequirePermission(Perms.Admin.LicensesBilling.View)]
        public async Task<IActionResult> GetMySummary()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _licenseService.GetSummaryAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("Mine/Add")]
        [RequirePermission(Perms.Admin.LicensesBilling.Edit)]
        public async Task<IActionResult> AddMine([FromBody] AddLicenseDto dto)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var userId = GetUserIdFromClaims();
            var result = await _licenseService.AddLicenseAsync(customerId, dto, userId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("Mine/{licenseId:int}")]
        [RequirePermission(Perms.Admin.LicensesBilling.Edit)]
        public async Task<IActionResult> RemoveMine(int licenseId)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var userId = GetUserIdFromClaims();
            var result = await _licenseService.RequestRemovalAsync(customerId, licenseId, userId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        // --- Super-admin ---

        [HttpGet("Customer/{customerId:int}")]
        public async Task<IActionResult> GetForCustomer(int customerId, [FromQuery] bool includeRemoved = false)
        {
            var result = await _licenseService.GetLicensesAsync(customerId, includeRemoved);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("Customer/Add")]
        public async Task<IActionResult> AddForCustomer([FromBody] AddLicenseAdminDto dto)
        {
            var userId = GetUserIdFromClaims();
            var result = await _licenseService.AddLicenseAsync(dto.CustomerId, dto, userId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("Customer/{customerId:int}/{licenseId:int}")]
        public async Task<IActionResult> RemoveForCustomer(int customerId, int licenseId)
        {
            var userId = GetUserIdFromClaims();
            var result = await _licenseService.RequestRemovalAsync(customerId, licenseId, userId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }

        // Resolve the active tenant context: prefer the JWT claim (tenant admins),
        // fall back to the CustomerId header (master admins acting on behalf of a tenant).
        private int GetCustomerIdFromClaims()
        {
            var claim = User.FindFirst("CustomerId")?.Value;
            if (int.TryParse(claim, out var fromClaim) && fromClaim > 0)
                return fromClaim;

            if (Request.Headers.TryGetValue("CustomerId", out var headerVal)
                && int.TryParse(headerVal.ToString(), out var fromHeader) && fromHeader > 0)
                return fromHeader;

            return 0;
        }
    }
}
