namespace BackOffice.Application.Interfaces.Services.Main;

public interface ISessionCacheService
{
    Task<bool> IsSessionActiveCachedAsync(Guid sessionId);
    void InvalidateSession(Guid sessionId);
    void CacheSessionActive(Guid sessionId);
}
