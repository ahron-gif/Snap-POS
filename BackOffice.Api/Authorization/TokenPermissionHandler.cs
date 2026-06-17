using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using SmartKartReg.Infrastructure.DBContext;

namespace BackOffice.Api.Authorization
{
    /// <summary>
    /// Authorization handler that validates token-based permissions.
    /// Business rules:
    /// 1. If token exists in DB AND has IsAllowed = false for the required permission → BLOCK
    /// 2. If token exists and permission is allowed → ALLOW
    /// 3. If token is NOT found in DB → do NOT block (pass-through, succeed)
    /// 4. If no token header present → pass-through (let JWT auth handle it)
    /// </summary>
    public class TokenPermissionHandler : AuthorizationHandler<TokenPermissionRequirement>
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<TokenPermissionHandler> _logger;

        public TokenPermissionHandler(
            IServiceScopeFactory scopeFactory,
            IHttpContextAccessor httpContextAccessor,
            ILogger<TokenPermissionHandler> logger)
        {
            _scopeFactory = scopeFactory;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        protected override async Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            TokenPermissionRequirement requirement)
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null)
            {
                // No HTTP context available, pass-through
                context.Succeed(requirement);
                return;
            }

            // Check for token in request headers (X-Api-Token or Authorization Bearer token for API clients)
            var tokenValue = httpContext.Request.Headers["X-Api-Token"].FirstOrDefault();

            if (string.IsNullOrWhiteSpace(tokenValue))
            {
                // No API token header → this is a regular user request, pass-through
                context.Succeed(requirement);
                return;
            }

            if (!Guid.TryParse(tokenValue, out var tokenGuid))
            {
                _logger.LogWarning("Invalid X-Api-Token format: {TokenValue}", tokenValue);
                context.Succeed(requirement); // Invalid format, pass-through
                return;
            }

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<RegistrationDbContext>();

                // Find the token in DB
                var storeToken = await dbContext.StoreTokens
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Token == tokenGuid);

                if (storeToken == null)
                {
                    // Token not found in DB → do NOT block
                    _logger.LogDebug("Token {TokenGuid} not found in DB, passing through.", tokenGuid);
                    context.Succeed(requirement);
                    return;
                }

                if (storeToken.Active != true)
                {
                    // Token is inactive → block
                    _logger.LogWarning("Token {TokenGuid} is inactive, blocking request.", tokenGuid);
                    context.Fail();
                    return;
                }

                // Check if there's a specific permission entry for the required permission key
                var permissionMapping = await dbContext.TokenPermissions
                    .AsNoTracking()
                    .Include(tp => tp.Permission)
                    .FirstOrDefaultAsync(tp =>
                        tp.TokenId == storeToken.Id &&
                        tp.Permission.PermissionKey == requirement.PermissionKey);

                if (permissionMapping == null)
                {
                    // No specific mapping for this permission → allow (not explicitly denied)
                    context.Succeed(requirement);
                    return;
                }

                if (permissionMapping.IsAllowed == true)
                {
                    // Explicitly allowed
                    context.Succeed(requirement);
                }
                else
                {
                    // Explicitly denied
                    _logger.LogWarning(
                        "Token {TokenGuid} denied permission {PermissionKey}.",
                        tokenGuid, requirement.PermissionKey);
                    context.Fail();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking token permission for {PermissionKey}", requirement.PermissionKey);
                // On error, fail-open (don't block) to prevent outages
                context.Succeed(requirement);
            }
        }
    }
}
