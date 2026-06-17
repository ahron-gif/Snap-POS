using System.IdentityModel.Tokens.Jwt;
using System.Text;
using BackOffice.PrintAgent.Services;
using Microsoft.IdentityModel.Tokens;

namespace BackOffice.PrintAgent.Security;

public interface IJobJwtValidator
{
    JobTokenValidationResult Validate(string token);
}

public record JobTokenValidationResult(bool IsValid, string? ErrorMessage = null, string? Jti = null, string? Origin = null);

public class JobJwtValidator : IJobJwtValidator
{
    private readonly IPairingService _pairingService;
    private readonly ILogger<JobJwtValidator> _logger;
    private readonly Dictionary<string, DateTimeOffset> _seenJti = new();
    private readonly object _jtiLock = new();

    public JobJwtValidator(IPairingService pairingService, ILogger<JobJwtValidator> logger)
    {
        _pairingService = pairingService;
        _logger = logger;
    }

    public JobTokenValidationResult Validate(string token)
    {
        var pairing = _pairingService.Current;
        if (!pairing.IsPaired)
        {
            return new JobTokenValidationResult(false, "Agent is not paired.");
        }

        try
        {
            var keyBytes = Convert.FromBase64String(pairing.Secret);
            var handler = new JwtSecurityTokenHandler();
            var parameters = new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = true,
                ValidAudience = "print-agent",
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
                ClockSkew = TimeSpan.FromSeconds(30)
            };

            var principal = handler.ValidateToken(token, parameters, out var validatedToken);
            var jwt = (JwtSecurityToken)validatedToken;
            var jti = jwt.Claims.FirstOrDefault(c => c.Type == "jti")?.Value;
            var origin = jwt.Claims.FirstOrDefault(c => c.Type == "origin")?.Value;

            if (string.IsNullOrEmpty(jti))
            {
                return new JobTokenValidationResult(false, "Token missing jti claim.");
            }

            lock (_jtiLock)
            {
                PurgeExpiredJti();
                if (_seenJti.ContainsKey(jti))
                {
                    return new JobTokenValidationResult(false, "Token already used.");
                }
                _seenJti[jti] = DateTimeOffset.UtcNow.AddMinutes(5);
            }

            return new JobTokenValidationResult(true, null, jti, origin);
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning(ex, "JWT validation failed");
            return new JobTokenValidationResult(false, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error validating JWT");
            return new JobTokenValidationResult(false, "Token validation failed.");
        }
    }

    private void PurgeExpiredJti()
    {
        var now = DateTimeOffset.UtcNow;
        var expired = _seenJti.Where(kv => kv.Value < now).Select(kv => kv.Key).ToList();
        foreach (var k in expired) _seenJti.Remove(k);
    }
}
