using BackOffice.PrintAgent.Security;
using BackOffice.PrintAgent.Services;
using BackOffice.PrintAgent.Services.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace BackOffice.PrintAgent.Endpoints;

public static class PrintAgentEndpoints
{
    public static void MapPrintAgentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", (
            IPairingService pairing,
            IOptions<PrintAgentSettings> settings,
            IHostApplicationLifetime lifetime) =>
        {
            var info = pairing.Current;
            return Results.Ok(new HealthResponse
            {
                Status = "ok",
                Version = settings.Value.Version,
                IsPaired = info.IsPaired,
                PairedOrigin = info.Origin,
                StartedAt = AgentRuntime.StartedAt
            });
        }).WithName("Health");

        app.MapGet("/status", (
            IPairingService pairing,
            IOptions<PrintAgentSettings> settings) =>
        {
            var info = pairing.Current;
            return Results.Ok(new
            {
                status = "ok",
                version = settings.Value.Version,
                hostMode = "windows-service",
                isPaired = info.IsPaired,
                pairedOrigin = info.Origin,
                pairedAt = info.PairedAt,
                createdAt = info.CreatedAt,
                startedAt = AgentRuntime.StartedAt,
                uptimeSeconds = (DateTimeOffset.UtcNow - AgentRuntime.StartedAt).TotalSeconds
            });
        }).WithName("Status");

        app.MapGet("/pairing", (IPairingService pairing) =>
        {
            var info = pairing.GetOrCreate();
            return Results.Ok(new
            {
                pairingId = info.PairingId,
                isPaired = info.IsPaired,
                pairedOrigin = info.Origin,
                createdAt = info.CreatedAt
            });
        }).WithName("Pairing");

        app.MapPost("/pairing/handshake", (
            HttpContext ctx,
            IPairingService pairing,
            [FromBody] HandshakeDto body) =>
        {
            var current = pairing.Current;
            if (string.IsNullOrWhiteSpace(body.PairingId) ||
                !string.Equals(body.PairingId, current.PairingId, StringComparison.Ordinal))
            {
                return Results.BadRequest(new { message = "Pairing code does not match." });
            }

            if (current.IsPaired)
            {
                return Results.Conflict(new { message = "Agent is already paired. Unpair from the BackOffice Settings page first." });
            }

            var origin = ctx.Request.Headers["Origin"].ToString();
            if (string.IsNullOrEmpty(origin))
            {
                return Results.BadRequest(new { message = "Origin header required." });
            }

            pairing.CompletePairing(origin);
            return Results.Ok(new
            {
                paired = true,
                origin,
                secret = current.Secret,
                pairingId = current.PairingId
            });
        }).WithName("HandshakePairing");

        app.MapPost("/pairing/reset", (
            HttpContext ctx,
            IPairingService pairing,
            IOptions<PrintAgentSettings> settings) =>
        {
            var current = pairing.Current;
            if (current.IsPaired)
            {
                var origin = ctx.Request.Headers["Origin"].ToString();
                var allowed = settings.Value.AllowedOrigins ?? new List<string>();
                var isAllowed =
                    !string.IsNullOrEmpty(origin) &&
                    (IsLocalOrigin(origin) ||
                     string.Equals(origin, current.Origin, StringComparison.OrdinalIgnoreCase) ||
                     allowed.Any(o => string.Equals(o, origin, StringComparison.OrdinalIgnoreCase)));

                if (!isAllowed)
                {
                    return Results.Json(new { message = "Origin not authorized to reset pairing." }, statusCode: StatusCodes.Status403Forbidden);
                }
            }
            pairing.Reset();
            return Results.Ok(new { reset = true });
        }).WithName("ResetPairing")
          .RequireRateLimiting("agent-default");

        app.MapGet("/printers", (IPrinterEnumerator enumerator) =>
        {
            return Results.Ok(enumerator.ListPrinters());
        }).WithName("ListPrinters")
          .RequireRateLimiting("agent-default");

        app.MapPost("/print", async (
            HttpContext ctx,
            IJobJwtValidator validator,
            IPrintJobService jobs,
            [FromBody] PrintRequest request,
            CancellationToken cancellationToken) =>
        {
            var auth = ctx.Request.Headers["Authorization"].ToString();
            if (string.IsNullOrEmpty(auth) || !auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Unauthorized();
            }

            var token = auth["Bearer ".Length..].Trim();
            var validation = validator.Validate(token);
            if (!validation.IsValid)
            {
                return Results.Json(new { message = validation.ErrorMessage }, statusCode: StatusCodes.Status401Unauthorized);
            }

            var origin = ctx.Request.Headers["Origin"].ToString();
            if (!string.IsNullOrEmpty(validation.Origin) && !string.IsNullOrEmpty(origin) &&
                !string.Equals(origin, validation.Origin, StringComparison.OrdinalIgnoreCase))
            {
                return Results.Json(new { message = "Origin mismatch." }, statusCode: StatusCodes.Status403Forbidden);
            }

            var result = await jobs.PrintAsync(request, cancellationToken);
            return result.Success ? Results.Ok(result) : Results.BadRequest(result);
        }).WithName("Print")
          .RequireRateLimiting("agent-print");
    }

    public class HandshakeDto
    {
        public string PairingId { get; set; } = string.Empty;
    }

    private static bool IsLocalOrigin(string origin)
    {
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
        var host = uri.Host;
        return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || host == "127.0.0.1"
            || host == "[::1]";
    }
}

public static class AgentRuntime
{
    public static DateTimeOffset StartedAt { get; } = DateTimeOffset.UtcNow;
}
