using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using BackOffice.Application.DTOs.Print;
using BackOffice.Application.Interfaces.Services.Print;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace BackOffice.Application.Services.Print
{
    public class PrintAgentService : IPrintAgentService
    {
        private const int JobTokenLifetimeSeconds = 60;
        private const string JobAudience = "print-agent";

        private readonly IPrintAgentPairingStore _store;
        private readonly ILogger<PrintAgentService> _logger;

        public PrintAgentService(IPrintAgentPairingStore store, ILogger<PrintAgentService> logger)
        {
            _store = store;
            _logger = logger;
        }

        public Task<PairAgentResponseDto> PairAsync(Guid userId, PairAgentRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.PairingId) || string.IsNullOrWhiteSpace(request.Secret))
            {
                throw new ArgumentException("Pairing id and secret are required.");
            }

            var stored = new StoredPairing
            {
                UserId = userId,
                PairingId = request.PairingId,
                Secret = request.Secret,
                Origin = request.Origin,
                PairedAt = DateTimeOffset.UtcNow
            };
            _store.Save(stored);
            _logger.LogInformation("Stored print agent pairing for user {UserId}", userId);

            return Task.FromResult(new PairAgentResponseDto
            {
                Paired = true,
                Origin = request.Origin,
                PairedAt = stored.PairedAt
            });
        }

        public Task<PrintAgentStatusDto> GetStatusAsync(Guid userId)
        {
            var pairing = _store.Get(userId);
            return Task.FromResult(pairing is null
                ? new PrintAgentStatusDto { Paired = false }
                : new PrintAgentStatusDto { Paired = true, Origin = pairing.Origin, PairedAt = pairing.PairedAt });
        }

        public Task UnpairAsync(Guid userId)
        {
            _store.Remove(userId);
            return Task.CompletedTask;
        }

        public Task<SignPrintJobResponseDto> SignPrintJobAsync(Guid userId, string origin, SignPrintJobRequestDto request)
        {
            var pairing = _store.Get(userId)
                ?? throw new InvalidOperationException("Print agent is not paired for this user.");

            var jobId = Guid.NewGuid().ToString("N");
            var now = DateTimeOffset.UtcNow;
            var expires = now.AddSeconds(JobTokenLifetimeSeconds);

            var keyBytes = Convert.FromBase64String(pairing.Secret);
            var creds = new SigningCredentials(new SymmetricSecurityKey(keyBytes), SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new("jti", jobId),
                new("origin", string.IsNullOrEmpty(origin) ? pairing.Origin : origin),
                new("printer", request.PrinterName ?? string.Empty),
                new("contentType", request.ContentType ?? "pdf"),
                new("sub", userId.ToString())
            };

            var token = new JwtSecurityToken(
                audience: JobAudience,
                claims: claims,
                notBefore: now.UtcDateTime,
                expires: expires.UtcDateTime,
                signingCredentials: creds);

            var handler = new JwtSecurityTokenHandler();
            return Task.FromResult(new SignPrintJobResponseDto
            {
                Token = handler.WriteToken(token),
                JobId = jobId,
                ExpiresAt = expires
            });
        }
    }
}
