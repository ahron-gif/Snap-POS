using BackOffice.Application.Interfaces.Services.Main;
using System.Security.Claims;
using Task = System.Threading.Tasks.Task;

namespace BackOffice.Api.Middlewares;

public class SessionValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SessionValidationMiddleware> _logger;
    private readonly IServiceScopeFactory _serviceScopeFactory;

    public SessionValidationMiddleware(RequestDelegate next, ILogger<SessionValidationMiddleware> logger, IServiceScopeFactory serviceScopeFactory)
    {
        _next = next;
        _logger = logger;
        _serviceScopeFactory = serviceScopeFactory;
    }

    // Paths that should bypass session validation (e.g., logout must work even with a revoked session)
    private static readonly HashSet<string> _bypassPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/Auth/logout",
        "/api/Auth/refresh",
        "/api/Auth/login",
        "/api/Auth/confirm-login",
        "/api/Auth/google-login",
        "/api/Auth/forgot-password",
        "/api/Auth/reset-password",
        // MFA step-2 endpoints — called before a full JWT is issued
        "/api/Auth/verify-mfa",
        "/api/Mfa/email/send-otp"
    };

    public async Task InvokeAsync(HttpContext context, ISessionCacheService sessionCacheService)
    {
        // Skip validation for bypass paths (login, logout, refresh, etc.)
        var path = context.Request.Path.Value ?? "";
        if (_bypassPaths.Contains(path))
        {
            await _next(context);
            return;
        }

        var authorizationHeader = context.Request.Headers["Authorization"].ToString();

        // Skip validation for unauthenticated requests
        if (string.IsNullOrEmpty(authorizationHeader) || !authorizationHeader.StartsWith("Bearer "))
        {
            await _next(context);
            return;
        }

        // Extract sid claim from JWT (populated by UseAuthentication middleware)
        var sidClaim = context.User.Claims.FirstOrDefault(c => c.Type == "sid")?.Value;

        // If no sid claim, allow through (grace period for old tokens)
        if (string.IsNullOrEmpty(sidClaim))
        {
            await _next(context);
            return;
        }

        if (!Guid.TryParse(sidClaim, out var sessionId))
        {
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Invalid session identifier.",
                sessionRevoked = true
            });
            return;
        }

        // Check if session is active (cache-first, then DB)
        var isActive = await sessionCacheService.IsSessionActiveCachedAsync(sessionId);

        if (!isActive)
        {
            _logger.LogWarning("Revoked session access attempt: SessionId={SessionId}", sessionId);
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Session has been revoked. Please login again.",
                sessionRevoked = true
            });
            return;
        }

        // Fire-and-forget: update last activity timestamp (uses its own DI scope to avoid DbContext concurrency)
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _serviceScopeFactory.CreateScope();
                var scopedSessionService = scope.ServiceProvider.GetRequiredService<ISessionService>();
                await scopedSessionService.UpdateLastActivityAsync(sessionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update last activity for session {SessionId}", sessionId);
            }
        });

        await _next(context);
    }
}
