using BackOffice.Application.DTOs.Main.SmtpSettings;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/superadmin/smtp")]
    [ApiController]
    [Authorize]
    public class SuperAdminSmtpController : ControllerBase
    {
        private readonly ISmtpAdminService _smtpAdminService;

        public SuperAdminSmtpController(ISmtpAdminService smtpAdminService)
        {
            _smtpAdminService = smtpAdminService;
        }

        [HttpGet("{customerId:int}/{storeId:guid}")]
        public async Task<IActionResult> Get(int customerId, Guid storeId)
        {
            if (!IsSuperAdmin()) return Forbid();
            var result = await _smtpAdminService.GetAsync(customerId, storeId);
            return Ok(result);
        }

        [HttpGet("stores/{customerId:int}")]
        public async Task<IActionResult> GetStores(int customerId)
        {
            if (!IsSuperAdmin()) return Forbid();
            var result = await _smtpAdminService.GetStoresAsync(customerId);
            return Ok(result);
        }

        [HttpPut("{customerId:int}")]
        public async Task<IActionResult> Update(int customerId, [FromBody] SmtpSettingsUpdateDto dto)
        {
            if (!IsSuperAdmin()) return Forbid();

            var userIdClaim = User.FindFirst("LocalUserId")?.Value;
            Guid? userId = Guid.TryParse(userIdClaim, out var g) ? g : null;

            var result = await _smtpAdminService.UpdateAsync(customerId, dto, userId);
            return Ok(result);
        }

        private bool IsSuperAdmin()
        {
            // Primary: RoleType claim set by AuthService at login (= "SuperAdmin"
            // when IsSuperAdmin flag is true, or for legacy CustomerId==null users).
            var roleClaim = User.FindFirst("RoleType")?.Value;
            if (string.Equals(roleClaim, "SuperAdmin", StringComparison.OrdinalIgnoreCase))
                return true;

            // Back-compat: dedicated IsSuperAdmin claim (not currently issued, kept
            // for forward-compat if AuthService ever adds it).
            var isSuperAdminClaim = User.FindFirst("IsSuperAdmin")?.Value;
            if (string.Equals(isSuperAdminClaim, "true", StringComparison.OrdinalIgnoreCase))
                return true;

            // Legacy fallback: empty/zero CustomerId claim.
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            return string.IsNullOrEmpty(customerIdClaim) || customerIdClaim == "0";
        }
    }
}
