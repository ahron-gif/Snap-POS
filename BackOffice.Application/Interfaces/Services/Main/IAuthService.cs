using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IAuthService
    {
        string AccessTokenName { get; }
        string RefreshTokenName { get; }

        // Method to generate an access token
        string GenerateAccessToken(string? email, string? name, string? roleType, int userId, int? customerId = null, Guid? localUserId = null);

        // Method to generate an access token with session ID claim
        string GenerateAccessToken(string? email, string? name, string? roleType, int userId, int? customerId, Guid? localUserId, Guid sessionId);

        // Method to generate an access token with session ID and permission version hash claims
        string GenerateAccessToken(string? email, string? name, string? roleType, int userId, int? customerId, Guid? localUserId, Guid sessionId, string? permissionVersionHash);

        // Method to generate a refresh token
        string GenerateRefreshToken(int userId, DateTime? expirationTime = null);

        // Method to validate a refresh token and extract user ID
        int? ValidateRefreshToken(string token);
    }
}
