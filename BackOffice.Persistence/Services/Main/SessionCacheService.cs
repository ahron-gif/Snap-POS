using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.Extensions.Caching.Memory;

namespace BackOffice.Persistence.Services.Main;

public class SessionCacheService : ISessionCacheService
{
    private readonly IMemoryCache _memoryCache;
    private readonly ISessionService _sessionService;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public SessionCacheService(IMemoryCache memoryCache, ISessionService sessionService)
    {
        _memoryCache = memoryCache;
        _sessionService = sessionService;
    }

    public async Task<bool> IsSessionActiveCachedAsync(Guid sessionId)
    {
        var cacheKey = $"session_active_{sessionId}";

        if (_memoryCache.TryGetValue(cacheKey, out bool isActive))
            return isActive;

        // Cache miss — query database
        isActive = await _sessionService.IsSessionActiveAsync(sessionId);

        _memoryCache.Set(cacheKey, isActive, CacheTtl);

        return isActive;
    }

    public void InvalidateSession(Guid sessionId)
    {
        var cacheKey = $"session_active_{sessionId}";
        _memoryCache.Remove(cacheKey);
    }

    public void CacheSessionActive(Guid sessionId)
    {
        var cacheKey = $"session_active_{sessionId}";
        _memoryCache.Set(cacheKey, true, CacheTtl);
    }
}
