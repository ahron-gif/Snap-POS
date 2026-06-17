using BackOffice.Application.DTOs.Auth;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;

namespace BackOffice.Persistence.Services.Main;

public class SessionService : ISessionService
{
    private readonly MainDBContext _mainDbContext;
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger<SessionService> _logger;

    public SessionService(MainDBContext mainDbContext, IMemoryCache memoryCache, ILogger<SessionService> logger)
    {
        _mainDbContext = mainDbContext;
        _memoryCache = memoryCache;
        _logger = logger;
    }

    #region Session Lifecycle

    public async Task<UserSession?> GetActiveSessionAsync(int userId, int? customerId)
    {
        return await _mainDbContext.UserSessions
            .FirstOrDefaultAsync(s => s.UserId == userId
                && s.CustomerId == customerId
                && s.IsActive);
    }

    public async Task<UserSession> CreateSessionAsync(int userId, int? customerId, string deviceInfo, string ipAddress, string refreshTokenHash)
    {
        var session = new UserSession
        {
            SessionId = Guid.NewGuid(),
            UserId = userId,
            CustomerId = customerId,
            DeviceInfo = deviceInfo?.Length > 500 ? deviceInfo[..500] : deviceInfo,
            IpAddress = ipAddress?.Length > 100 ? ipAddress[..100] : ipAddress,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow,
            RefreshTokenHash = refreshTokenHash,
            RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30)
        };

        _mainDbContext.UserSessions.Add(session);

        try
        {
            await _mainDbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message?.Contains("IX_UserSessions_ActiveUserCustomer") == true)
        {
            _logger.LogWarning("Concurrent session creation detected for UserId={UserId}, CustomerId={CustomerId}", userId, customerId);
            throw new InvalidOperationException("An active session already exists for this user.");
        }

        return session;
    }

    public async Task<bool> RevokeSessionAsync(Guid sessionId, string reason)
    {
        var session = await _mainDbContext.UserSessions
            .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.IsActive);

        if (session == null) return false;

        session.IsActive = false;
        session.RevokedAt = DateTime.UtcNow;
        session.RevokedReason = reason?.Length > 50 ? reason[..50] : reason;

        await _mainDbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> IsSessionActiveAsync(Guid sessionId)
    {
        return await _mainDbContext.UserSessions
            .AnyAsync(s => s.SessionId == sessionId && s.IsActive);
    }

    public async Task UpdateLastActivityAsync(Guid sessionId)
    {
        await _mainDbContext.Database.ExecuteSqlRawAsync(
            "UPDATE UserSessions SET LastActivityAt = GETUTCDATE() WHERE SessionId = {0} AND IsActive = 1",
            sessionId);
    }

    #endregion

    #region Customer Limit

    public async Task<int> GetActiveSessionCountAsync(int customerId)
    {
        return await _mainDbContext.UserSessions
            .CountAsync(s => s.CustomerId == customerId && s.IsActive);
    }

    public async Task<int> GetMaxConcurrentUsersAsync(int customerId)
    {
        var cacheKey = $"customer_max_users_{customerId}";
        if (_memoryCache.TryGetValue(cacheKey, out int maxUsers))
            return maxUsers;

        var customer = await _mainDbContext.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CustomerId == customerId);

        maxUsers = customer?.MaxConcurrentUsers ?? 0;
        _memoryCache.Set(cacheKey, maxUsers, TimeSpan.FromMinutes(10));
        return maxUsers;
    }

    public async Task<List<UserSession>> GetActiveSessionsForCustomerAsync(int customerId)
    {
        return await _mainDbContext.UserSessions
            .Where(s => s.CustomerId == customerId && s.IsActive)
            .OrderBy(s => s.CreatedAt)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<List<ActiveSessionDetailDto>> GetActiveSessionsWithUserInfoAsync(int customerId)
    {
        return await (from s in _mainDbContext.UserSessions
                      join u in _mainDbContext.WebAppUsers on s.UserId equals u.UserId
                      where s.CustomerId == customerId && s.IsActive
                      orderby s.LastActivityAt descending
                      select new ActiveSessionDetailDto
                      {
                          SessionId = s.SessionId,
                          UserName = u.UserName,
                          DeviceInfo = s.DeviceInfo,
                          IpAddress = s.IpAddress,
                          LastActivityAt = s.LastActivityAt
                      }).AsNoTracking().ToListAsync();
    }

    public async Task<UserSession?> GetOldestActiveSessionAsync(int customerId)
    {
        return await _mainDbContext.UserSessions
            .Where(s => s.CustomerId == customerId && s.IsActive)
            .OrderBy(s => s.CreatedAt)
            .FirstOrDefaultAsync();
    }

    public async Task<bool> RevokeOldestSessionAsync(int customerId, string reason)
    {
        var oldest = await GetOldestActiveSessionAsync(customerId);
        if (oldest == null) return false;

        return await RevokeSessionAsync(oldest.SessionId, reason);
    }

    public async Task<bool> ValidateSessionBelongsToCustomerAsync(Guid sessionId, int customerId)
    {
        return await _mainDbContext.UserSessions
            .AnyAsync(s => s.SessionId == sessionId && s.CustomerId == customerId && s.IsActive);
    }

    #endregion

    #region Temporary Login Token

    public async Task<(string RawToken, Guid TokenId)> CreateTemporaryLoginTokenAsync(
        int userId, int? customerId, string conflictType,
        Guid? existingSessionId, string deviceInfo, string ipAddress)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var tokenHash = ComputeSha256Hash(rawToken);

        var token = new TemporaryLoginToken
        {
            TokenId = Guid.NewGuid(),
            UserId = userId,
            CustomerId = customerId,
            TokenHash = tokenHash,
            DeviceInfo = deviceInfo?.Length > 500 ? deviceInfo[..500] : deviceInfo,
            IpAddress = ipAddress?.Length > 100 ? ipAddress[..100] : ipAddress,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddSeconds(60),
            IsUsed = false,
            ConflictType = conflictType,
            ExistingSessionId = existingSessionId
        };

        _mainDbContext.TemporaryLoginTokens.Add(token);
        await _mainDbContext.SaveChangesAsync();

        return (rawToken, token.TokenId);
    }

    public async Task<TemporaryLoginToken?> ValidateTemporaryTokenAsync(string rawToken)
    {
        var tokenHash = ComputeSha256Hash(rawToken);

        return await _mainDbContext.TemporaryLoginTokens
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash
                && !t.IsUsed
                && t.ExpiresAt > DateTime.UtcNow);
    }

    public async Task ConsumeTemporaryTokenAsync(Guid tokenId)
    {
        var token = await _mainDbContext.TemporaryLoginTokens
            .FirstOrDefaultAsync(t => t.TokenId == tokenId);

        if (token != null)
        {
            token.IsUsed = true;
            await _mainDbContext.SaveChangesAsync();
        }
    }

    #endregion

    #region Refresh Token

    public async Task<UserSession?> GetSessionByRefreshTokenHashAsync(string hash)
    {
        return await _mainDbContext.UserSessions
            .FirstOrDefaultAsync(s => s.RefreshTokenHash == hash && s.IsActive);
    }

    public async Task UpdateRefreshTokenAsync(Guid sessionId, string newHash, DateTime expiresAt)
    {
        var session = await _mainDbContext.UserSessions
            .FirstOrDefaultAsync(s => s.SessionId == sessionId);

        if (session != null)
        {
            session.RefreshTokenHash = newHash;
            session.RefreshTokenExpiresAt = expiresAt;
            await _mainDbContext.SaveChangesAsync();
        }
    }

    #endregion

    #region Cleanup

    public async Task CleanupExpiredSessionsAsync()
    {
        var threshold = DateTime.UtcNow.AddDays(-30);

        var expiredSessions = await _mainDbContext.UserSessions
            .Where(s => !s.IsActive && s.RevokedAt != null && s.RevokedAt < threshold)
            .ToListAsync();

        if (expiredSessions.Count > 0)
        {
            _mainDbContext.UserSessions.RemoveRange(expiredSessions);
            await _mainDbContext.SaveChangesAsync();
            _logger.LogInformation("Cleaned up {Count} expired sessions", expiredSessions.Count);
        }
    }

    public async Task CleanupExpiredTemporaryTokensAsync()
    {
        var threshold = DateTime.UtcNow.AddHours(-1);

        var expiredTokens = await _mainDbContext.TemporaryLoginTokens
            .Where(t => t.ExpiresAt < threshold)
            .ToListAsync();

        if (expiredTokens.Count > 0)
        {
            _mainDbContext.TemporaryLoginTokens.RemoveRange(expiredTokens);
            await _mainDbContext.SaveChangesAsync();
            _logger.LogInformation("Cleaned up {Count} expired temporary tokens", expiredTokens.Count);
        }
    }

    public async Task<int> DeactivateStaleSessionsAsync(int userId, int? customerId, TimeSpan idleThreshold)
    {
        var cutoff = DateTime.UtcNow - idleThreshold;

        var stale = await _mainDbContext.UserSessions
            .Where(s => s.UserId == userId
                && s.CustomerId == customerId
                && s.IsActive
                && s.LastActivityAt < cutoff)
            .ToListAsync();

        if (stale.Count == 0) return 0;

        var now = DateTime.UtcNow;
        foreach (var session in stale)
        {
            session.IsActive = false;
            session.RevokedAt = now;
            session.RevokedReason = "stale_idle";
        }
        await _mainDbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Deactivated {Count} stale session(s) for UserId={UserId}, CustomerId={CustomerId} (idle > {Threshold})",
            stale.Count, userId, customerId, idleThreshold);

        return stale.Count;
    }

    #endregion

    #region Helpers

    public static string ComputeSha256Hash(string input)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    #endregion
}
