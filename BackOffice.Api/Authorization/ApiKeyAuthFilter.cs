using System.Security.Claims;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Authorization
{
    /// <summary>
    /// Authorization filter for <see cref="ApiKeyAuthAttribute"/>. Runs before
    /// action filters and model binding so the action sees a populated
    /// <c>HttpContext.User</c> with a CustomerId claim.
    /// </summary>
    public class ApiKeyAuthFilter : IAsyncAuthorizationFilter
    {
        public const string HeaderName = "X-Api-Key";
        private readonly MainDBContext _dbContext;
        private readonly ILogger<ApiKeyAuthFilter> _logger;

        public ApiKeyAuthFilter(MainDBContext dbContext, ILogger<ApiKeyAuthFilter> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            var headerValue = context.HttpContext.Request.Headers[HeaderName].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(headerValue))
            {
                Reject(context, 401, "missing_api_key", $"Header '{HeaderName}' is required.");
                return;
            }

            if (!Guid.TryParse(headerValue, out var apiKey) || apiKey == Guid.Empty)
            {
                Reject(context, 401, "invalid_api_key", "API key is not a valid identifier.");
                return;
            }

            var customer = await _dbContext.Customers
                .Where(c => c.LicenseKey == apiKey && c.IsActive)
                .Select(c => new { c.CustomerId, c.CustomerName })
                .FirstOrDefaultAsync();

            if (customer == null)
            {
                _logger.LogWarning(
                    "ApiKeyAuth: unknown or inactive license key from {Ip} (path {Path})",
                    context.HttpContext.Connection.RemoteIpAddress,
                    context.HttpContext.Request.Path);
                Reject(context, 401, "invalid_api_key", "API key not recognised or customer disabled.");
                return;
            }

            // Populate the principal so:
            //   * CustomerId-from-claims helpers in controllers continue to work
            //   * [MeterApiCall] picks up CustomerId without modification
            //   * IUsageTrackingService.RecordApiCallAsync sees the right tenant
            var identity = new ClaimsIdentity(authenticationType: "ApiKey");
            identity.AddClaim(new Claim("CustomerId", customer.CustomerId.ToString()));
            identity.AddClaim(new Claim(ClaimTypes.Name, customer.CustomerName ?? $"Customer-{customer.CustomerId}"));
            identity.AddClaim(new Claim("AuthMethod", "ApiKey"));
            context.HttpContext.User = new ClaimsPrincipal(identity);
        }

        private static void Reject(AuthorizationFilterContext ctx, int status, string code, string message)
        {
            ctx.Result = new ObjectResult(ApiResponseFactory.Forbidden<object>(message))
            {
                StatusCode = status,
            };
            ctx.HttpContext.Response.Headers["X-Auth-Error"] = code;
        }
    }
}
