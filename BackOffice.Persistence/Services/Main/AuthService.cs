using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Main
{
    public class AuthService : IAuthService
    {
        private readonly JwtOptions _jwtOptions;

        // Constructor injection
        public AuthService(IOptions<JwtOptions> options)
        {
            _jwtOptions = options.Value;
        }

        public string AccessTokenName => _jwtOptions.AccessTokenName;
        public string RefreshTokenName => _jwtOptions.RefreshTokenName;

        public string GenerateAccessToken(
            string? email, string? name, string? roleType, int userId,
            int? customerId = null, Guid? localUserId = null)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, email ?? string.Empty),
                new Claim(ClaimTypes.Name, name ?? string.Empty),
                new Claim("CustomerId", customerId?.ToString() ?? string.Empty),
                new Claim("RoleType", roleType?.ToString() ?? string.Empty),
                new Claim("UserId", userId.ToString()),
                new Claim("LocalUserId", localUserId?.ToString() ?? string.Empty)
            };

            return CreateToken(claims, DateTime.UtcNow.AddDays(_jwtOptions.AccessTokenExpireDays));
        }

        public string GenerateAccessToken(
            string? email, string? name, string? roleType, int userId,
            int? customerId, Guid? localUserId, Guid sessionId)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, email ?? string.Empty),
                new Claim(ClaimTypes.Name, name ?? string.Empty),
                new Claim("CustomerId", customerId?.ToString() ?? string.Empty),
                new Claim("RoleType", roleType?.ToString() ?? string.Empty),
                new Claim("UserId", userId.ToString()),
                new Claim("LocalUserId", localUserId?.ToString() ?? string.Empty),
                new Claim("sid", sessionId.ToString())
            };

            return CreateToken(claims, DateTime.UtcNow.AddDays(_jwtOptions.AccessTokenExpireDays));
        }

        public string GenerateAccessToken(
            string? email, string? name, string? roleType, int userId,
            int? customerId, Guid? localUserId, Guid sessionId, string? permissionVersionHash)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Email, email ?? string.Empty),
                new Claim(ClaimTypes.Name, name ?? string.Empty),
                new Claim("CustomerId", customerId?.ToString() ?? string.Empty),
                new Claim("RoleType", roleType?.ToString() ?? string.Empty),
                new Claim("UserId", userId.ToString()),
                new Claim("LocalUserId", localUserId?.ToString() ?? string.Empty),
                new Claim("sid", sessionId.ToString()),
                new Claim("pv", permissionVersionHash ?? string.Empty)
            };

            return CreateToken(claims, DateTime.UtcNow.AddDays(_jwtOptions.AccessTokenExpireDays));
        }

        public string GenerateRefreshToken(int userId, DateTime? expirationTime = null)
        {
            var claims = new List<Claim>
        {
            new Claim("UserId", userId.ToString())
        };

            var expireAt = expirationTime ?? DateTime.UtcNow.AddDays(_jwtOptions.RefreshTokenExpireDays);
            return CreateToken(claims, expireAt);
        }

        public int? ValidateRefreshToken(string token)
        {
            try
            {
                var principal = ValidateToken(token);
                var userIdClaim = principal?.Claims.FirstOrDefault(c => c.Type == "UserId");
                return userIdClaim != null && int.TryParse(userIdClaim.Value, out var id) ? id : null;
            }
            catch
            {
                return null;
            }
        }

        private string CreateToken(List<Claim> claims, DateTime expireAt)
        {
            var handler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_jwtOptions.IssuerSigningKey);
            var identity = new ClaimsIdentity(claims);
            var now = DateTime.UtcNow;

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = identity,
                Expires = expireAt,
                NotBefore = now,
                IssuedAt = now,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256),
                Issuer = _jwtOptions.ValidIssuer,
                Audience = _jwtOptions.ValidAudience
            };

            var token = handler.CreateToken(tokenDescriptor);
            return handler.WriteToken(token);
        }

        private ClaimsPrincipal? ValidateToken(string token)
        {
            var handler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_jwtOptions.IssuerSigningKey);

            try
            {
                return handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero // No clock skew for token expiration validation
                }, out _);
            }
            catch
            {
                return null;
            }
        }
    }

}

