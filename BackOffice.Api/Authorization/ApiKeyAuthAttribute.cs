using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Authorization
{
    /// <summary>
    /// Authenticates the request via the <c>X-Api-Key</c> header. The header
    /// value must be a Guid matching <c>dbo.Customers.LicenseKey</c>.
    ///
    /// On success, replaces <c>HttpContext.User</c> with a ClaimsPrincipal that
    /// carries:
    ///   * "CustomerId"   = matched customer
    ///   * ClaimTypes.Name = customer name
    ///   * "AuthMethod"   = "ApiKey"
    ///
    /// Use on endpoints called by headless apps (POS, Back Office desktop,
    /// Shipscan, Price Checker) that don't carry a user JWT. Do NOT combine
    /// with <c>[Authorize]</c> on the same action — they conflict. Use the
    /// existing <c>[Authorize]</c> for the web admin UI, this attribute for
    /// device-side calls.
    ///
    /// Usage:
    ///   [Route("api/DeviceLicense")]
    ///   [ApiController]
    ///   [ApiKeyAuth]
    ///   public class DeviceLicenseController : ControllerBase { ... }
    /// </summary>
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
    public class ApiKeyAuthAttribute : TypeFilterAttribute
    {
        public ApiKeyAuthAttribute() : base(typeof(ApiKeyAuthFilter))
        {
        }
    }
}
