using BackOffice.Application.DTOs.Auth;
using BackOffice.Domain.Entities.Main;

namespace BackOffice.Application.Interfaces.Services.Main;

public interface ISessionService
{
    // Session lifecycle
    Task<UserSession?> GetActiveSessionAsync(int userId, int? customerId);
    Task<UserSession> CreateSessionAsync(int userId, int? customerId, string deviceInfo, string ipAddress, string refreshTokenHash);
    Task<bool> RevokeSessionAsync(Guid sessionId, string reason);
    Task<bool> IsSessionActiveAsync(Guid sessionId);
    Task UpdateLastActivityAsync(Guid sessionId);

    // Customer limit
    Task<int> GetActiveSessionCountAsync(int customerId);
    Task<int> GetMaxConcurrentUsersAsync(int customerId);
    Task<List<UserSession>> GetActiveSessionsForCustomerAsync(int customerId);
    Task<List<ActiveSessionDetailDto>> GetActiveSessionsWithUserInfoAsync(int customerId);
    Task<UserSession?> GetOldestActiveSessionAsync(int customerId);
    Task<bool> RevokeOldestSessionAsync(int customerId, string reason);
    Task<bool> ValidateSessionBelongsToCustomerAsync(Guid sessionId, int customerId);

    // Temporary login token
    Task<(string RawToken, Guid TokenId)> CreateTemporaryLoginTokenAsync(
        int userId, int? customerId, string conflictType,
        Guid? existingSessionId, string deviceInfo, string ipAddress);
    Task<TemporaryLoginToken?> ValidateTemporaryTokenAsync(string rawToken);
    Task ConsumeTemporaryTokenAsync(Guid tokenId);

    // Refresh token
    Task<UserSession?> GetSessionByRefreshTokenHashAsync(string hash);
    Task UpdateRefreshTokenAsync(Guid sessionId, string newHash, DateTime expiresAt);

    // Cleanup
    Task CleanupExpiredSessionsAsync();
    Task CleanupExpiredTemporaryTokensAsync();

    /// <summary>
    /// Deactivates any sessions for the (userId, customerId) pair whose
    /// last activity is older than `idleThreshold`. Used by the login flow
    /// to prune sessions abandoned by closed browsers / dead tabs before
    /// the active-session check, so a user re-logging in from the same
    /// browser after a long absence doesn't see the "active session" modal
    /// triggered by their own stale row.
    /// </summary>
    /// <returns>The number of sessions deactivated.</returns>
    Task<int> DeactivateStaleSessionsAsync(int userId, int? customerId, TimeSpan idleThreshold);
}
