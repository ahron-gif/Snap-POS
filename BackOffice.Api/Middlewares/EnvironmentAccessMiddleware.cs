using BackOffice.Application.Interfaces.Services.Main;

namespace BackOffice.Api.Middlewares;

/// <summary>
/// Validates that every authenticated web-app request comes from a user who:
///   1. Has HasWebAccess = true on their account, AND
///   2. Has a UserEnvironments entry matching the current deployment environment
///      (read from appsettings CurrentEnvironmentId as GUID).
///
/// SuperAdmins (role claim == "SuperAdmin") bypass both checks.
/// Runs AFTER UseAuthentication and SessionValidationMiddleware.
/// </summary>
public class EnvironmentAccessMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<EnvironmentAccessMiddleware> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly Guid _currentEnvironmentId;

    // Auth-related paths that must never be blocked (user is not yet logged in)
    private static readonly HashSet<string> _bypassPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/Auth/login",
        "/api/Auth/confirm-login",
        "/api/Auth/google-login",
        "/api/Auth/logout",
        "/api/Auth/refresh",
        "/api/Auth/forgot-password",
        "/api/Auth/reset-password",
        "/api/Auth/verify-mfa",
        "/api/Mfa/email/send-otp",
    };

    public EnvironmentAccessMiddleware(
        RequestDelegate next,
        ILogger<EnvironmentAccessMiddleware> logger,
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _scopeFactory = scopeFactory;
        var envIdStr = (configuration["CurrentEnvironmentId"] ?? "").Trim();
        _currentEnvironmentId = Guid.TryParse(envIdStr, out var parsed) ? parsed : Guid.Empty;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";

        // Skip bypass paths (login, refresh, etc.)
        if (_bypassPaths.Contains(path))
        {
            await _next(context);
            return;
        }

        // Skip unauthenticated requests — SessionValidationMiddleware handles those
        var authHeader = context.Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // SuperAdmins bypass environment checks entirely
        var roleClaim = context.User.Claims.FirstOrDefault(c => c.Type == "role")?.Value
                     ?? context.User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value;
        if (string.Equals(roleClaim, "SuperAdmin", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // Extract UserId and CustomerId from JWT claims
        var userIdClaim = context.User.Claims.FirstOrDefault(c => c.Type == "UserId")?.Value;
        var customerIdClaim = context.User.Claims.FirstOrDefault(c => c.Type == "CustomerId")?.Value;

        if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
        {
            // No valid user identity — let existing auth middleware reject it
            await _next(context);
            return;
        }

        int.TryParse(customerIdClaim, out var customerId);

        using var scope = _scopeFactory.CreateScope();
        var envService = scope.ServiceProvider.GetRequiredService<IEnvironmentAccessService>();

        // ── Check 1: HasWebAccess ──────────────────────────────────────────
        var hasWebAccess = await envService.HasWebAccessAsync(userId);
        if (!hasWebAccess)
        {
            _logger.LogWarning(
                "Web access denied — UserId: {UserId} does not have web access.",
                userId);
            context.Response.StatusCode = 403;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "web_access_denied",
                message = "Your account does not have access to this application. Please contact your administrator."
            });
            return;
        }

        // ── Check 2: Environment access ───────────────────────────────────
        // Only enforce if CurrentEnvironmentId is a valid non-empty GUID and CustomerId is known
        if (_currentEnvironmentId != Guid.Empty && customerId > 0)
        {
            var hasEnvAccess = await envService.HasEnvironmentAccessByIdAsync(userId, customerId, _currentEnvironmentId);
            if (!hasEnvAccess)
            {
                _logger.LogWarning(
                    "Environment access denied — UserId: {UserId}, CustomerId: {CustomerId}, EnvironmentId: {EnvId}.",
                    userId, customerId, _currentEnvironmentId);
                context.Response.StatusCode = 403;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "environment_access_denied",
                    message = "Your account is not authorized for this environment. Please contact your administrator."
                });
                return;
            }
        }

        await _next(context);
    }
}
