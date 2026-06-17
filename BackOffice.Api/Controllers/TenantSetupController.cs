using BackOffice.Application.DTOs.Tenant.Setup;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Read-only tenant-wide setup flags (StoreType + module switches)
    /// surfaced from the encrypted EncData blob. The React app calls this
    /// once at login / context-load so the Item form, Matrix form, etc.
    /// can drive show/hide behaviour without round-tripping the encrypted
    /// payload to every screen.
    ///
    /// Resolves the tenant the same way the rest of the tenant-side
    /// controllers do: <c>CustomerId</c> request header (multi-tenant
    /// switcher) takes precedence over the JWT <c>CustomerId</c> claim.
    /// SuperAdmin callers must pass the header explicitly; without it
    /// the endpoint has no tenant to read.
    /// </summary>
    [Route("api/Tenant/[controller]")]
    [ApiController]
    [Authorize]
    public class SetupController : ControllerBase
    {
        private readonly ITenantSetupService _tenantSetupService;
        private readonly ILogger<SetupController> _logger;

        public SetupController(
            ITenantSetupService tenantSetupService,
            ILogger<SetupController> logger)
        {
            _tenantSetupService = tenantSetupService;
            _logger = logger;
        }

        /// <summary>
        /// GET /api/Tenant/Setup — returns the cached, non-sensitive tenant
        /// flags. Safe for every authenticated user; contains no secrets.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetSetup(CancellationToken ct)
        {
            var customerId = ResolveCustomerId();
            if (customerId <= 0)
            {
                return BadRequest(new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = "Tenant could not be resolved from the request."
                });
            }

            try
            {
                var dto = await _tenantSetupService.GetSetupAsync(customerId, ct);
                return Ok(new ApiResponse<TenantSetupDto>
                {
                    IsSuccess = true,
                    Response = dto
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load TenantSetup for Customer {CustomerId}.", customerId);
                return StatusCode(500, new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = "Failed to load tenant setup."
                });
            }
        }

        /// <summary>
        /// Same precedence the tenant DB middleware uses — explicit header
        /// (set by the multi-tenant switcher / SuperAdmin tools) wins, then
        /// fall back to the user's own CustomerId claim.
        /// </summary>
        private int ResolveCustomerId()
        {
            var headerValue = HttpContext.Request.Headers["CustomerId"].ToString();
            if (!string.IsNullOrEmpty(headerValue)
                && int.TryParse(headerValue, out var headerCustomerId)
                && headerCustomerId > 0)
            {
                return headerCustomerId;
            }

            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            return int.TryParse(customerIdClaim, out var customerId) ? customerId : 0;
        }
    }
}
