using BackOffice.Application.DTOs.Environments;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main;

public class EnvironmentAccessService : IEnvironmentAccessService
{
    private readonly MainDBContext _db;
    private readonly IMemoryCache _cache;
    private readonly ILogger<EnvironmentAccessService> _logger;

    // Cache TTL – short enough that access changes take effect quickly
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public EnvironmentAccessService(
        MainDBContext db,
        IMemoryCache cache,
        ILogger<EnvironmentAccessService> logger)
    {
        _db = db;
        _cache = cache;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Environment CRUD
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<List<EnvironmentDto>> GetAllEnvironmentsAsync()
    {
        return await _db.Environments
            .OrderBy(e => e.Name)
            .Select(e => new EnvironmentDto
            {
                Id = e.Id,
                Name = e.Name,
                Code = e.Code,
                IsActive = e.IsActive
            })
            .ToListAsync();
    }

    public async Task<EnvironmentDto?> GetEnvironmentByIdAsync(Guid id)
    {
        var e = await _db.Environments.FindAsync(id);
        return e == null ? null : Map(e);
    }

    public async Task<EnvironmentDto> CreateEnvironmentAsync(CreateEnvironmentDto dto)
    {
        var env = new AppEnvironment
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim().ToUpperInvariant(),
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Environments.Add(env);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Environment created: {Code}", env.Code);
        return Map(env);
    }

    public async Task<EnvironmentDto?> UpdateEnvironmentAsync(UpdateEnvironmentDto dto)
    {
        var env = await _db.Environments.FindAsync(dto.Id);
        if (env == null) return null;

        env.Name = dto.Name.Trim();
        env.Code = dto.Code.Trim().ToUpperInvariant();
        env.IsActive = dto.IsActive;
        env.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Environment updated: {Code}", env.Code);
        return Map(env);
    }

    public async Task<bool> DeleteEnvironmentAsync(Guid id)
    {
        var env = await _db.Environments.FindAsync(id);
        if (env == null) return false;

        var inUse = await _db.UserEnvironments.AnyAsync(ue => ue.EnvironmentId == id);
        if (inUse)
        {
            _logger.LogWarning("Cannot delete environment {Id} — it has active user assignments.", id);
            return false;
        }

        _db.Environments.Remove(env);
        await _db.SaveChangesAsync();
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // User-Environment Assignments
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<UserEnvironmentAccessDto> GetUserEnvironmentAccessAsync(int userId, int customerId)
    {
        var user = await _db.WebAppUsers
            .Where(u => u.UserId == userId)
            .Select(u => new { u.HasWebAccess })
            .FirstOrDefaultAsync();

        var envs = await _db.UserEnvironments
            .Where(ue => ue.UserId == userId && ue.CustomerId == customerId)
            .Join(_db.Environments, ue => ue.EnvironmentId, e => e.Id,
                (ue, e) => new UserEnvironmentDto
                {
                    Id = ue.Id,
                    UserId = ue.UserId,
                    CustomerId = ue.CustomerId,
                    EnvironmentId = ue.EnvironmentId,
                    EnvironmentName = e.Name,
                    EnvironmentCode = e.Code
                })
            .ToListAsync();

        return new UserEnvironmentAccessDto
        {
            HasWebAccess = user?.HasWebAccess ?? true,
            Environments = envs
        };
    }

    public async Task SetUserEnvironmentsAsync(SetUserEnvironmentsDto dto)
    {
        // 1. Update HasWebAccess flag on the user
        var user = await _db.WebAppUsers.FindAsync(dto.UserId);
        if (user != null)
            user.HasWebAccess = dto.HasWebAccess;

        // 2. Replace all existing UserEnvironment rows for this user+customer
        var existing = await _db.UserEnvironments
            .Where(ue => ue.UserId == dto.UserId && ue.CustomerId == dto.CustomerId)
            .ToListAsync();
        _db.UserEnvironments.RemoveRange(existing);

        // 3. Insert new rows
        foreach (var envId in dto.EnvironmentIds.Distinct())
        {
            _db.UserEnvironments.Add(new UserEnvironment
            {
                Id = Guid.NewGuid(),
                UserId = dto.UserId,
                CustomerId = dto.CustomerId,
                EnvironmentId = envId,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        // 4. Bust cache — pass all affected env IDs (old + new) so ID-based keys are evicted too
        var allAffectedIds = existing.Select(e => e.EnvironmentId)
            .Concat(dto.EnvironmentIds)
            .Distinct();
        InvalidateUserAccessCache(dto.UserId, dto.CustomerId, allAffectedIds);
        _logger.LogInformation(
            "Environment access updated — UserId: {UserId}, CustomerId: {CustomerId}, Environments: [{Envs}], WebAccess: {Web}",
            dto.UserId, dto.CustomerId, string.Join(",", dto.EnvironmentIds), dto.HasWebAccess);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Access Checks
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<bool> HasWebAccessAsync(int userId)
    {
        var cacheKey = $"web_access_{userId}";
        if (_cache.TryGetValue(cacheKey, out bool cached))
            return cached;

        var user = await _db.WebAppUsers
            .Where(u => u.UserId == userId)
            .Select(u => new { u.HasWebAccess, u.IsSuperAdmin })
            .FirstOrDefaultAsync();

        if (user == null) return false;

        // SuperAdmins always have web access
        var result = user.IsSuperAdmin == true || user.HasWebAccess;
        _cache.Set(cacheKey, result, CacheTtl);
        return result;
    }

    public async Task<bool> HasEnvironmentAccessByIdAsync(int userId, int customerId, Guid environmentId)
    {
        var cacheKey = $"env_access_id_{userId}_{customerId}_{environmentId}";
        if (_cache.TryGetValue(cacheKey, out bool cached))
            return cached;

        // SuperAdmins bypass the environment check
        var isSuperAdmin = await _db.WebAppUsers
            .Where(u => u.UserId == userId)
            .Select(u => (bool?)u.IsSuperAdmin)
            .FirstOrDefaultAsync();

        if (isSuperAdmin == true)
        {
            _cache.Set(cacheKey, true, CacheTtl);
            return true;
        }

        var result = await _db.UserEnvironments
            .AnyAsync(ue =>
                ue.UserId == userId &&
                ue.CustomerId == customerId &&
                ue.EnvironmentId == environmentId);

        _cache.Set(cacheKey, result, CacheTtl);
        return result;
    }

    public async Task<bool> HasEnvironmentAccessAsync(int userId, int customerId, string environmentCode)
    {
        var cacheKey = $"env_access_{userId}_{customerId}_{environmentCode.ToUpperInvariant()}";
        if (_cache.TryGetValue(cacheKey, out bool cached))
            return cached;

        // SuperAdmins bypass the environment check
        var isSuperAdmin = await _db.WebAppUsers
            .Where(u => u.UserId == userId)
            .Select(u => (bool?)u.IsSuperAdmin)
            .FirstOrDefaultAsync();

        if (isSuperAdmin == true)
        {
            _cache.Set(cacheKey, true, CacheTtl);
            return true;
        }

        var code = environmentCode.ToUpperInvariant();
        var result = await _db.UserEnvironments
            .Join(_db.Environments, ue => ue.EnvironmentId, e => e.Id,
                (ue, e) => new { ue, e })
            .AnyAsync(x =>
                x.ue.UserId == userId &&
                x.ue.CustomerId == customerId &&
                x.e.Code == code &&
                x.e.IsActive);

        _cache.Set(cacheKey, result, CacheTtl);
        return result;
    }

    public void InvalidateUserAccessCache(int userId, int customerId, IEnumerable<Guid>? envIds = null)
    {
        // Evict the web-access flag
        _cache.Remove($"web_access_{userId}");

        // Evict code-based env access keys (well-known codes)
        foreach (var code in new[] { "DEV", "QA", "UAT", "PROD" })
            _cache.Remove($"env_access_{userId}_{customerId}_{code}");

        // Evict ID-based env access keys
        if (envIds != null)
            foreach (var id in envIds)
                _cache.Remove($"env_access_id_{userId}_{customerId}_{id}");

        _logger.LogDebug("Access cache invalidated for UserId: {UserId}, CustomerId: {CustomerId}", userId, customerId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static EnvironmentDto Map(AppEnvironment e) => new()
    {
        Id = e.Id,
        Name = e.Name,
        Code = e.Code,
        IsActive = e.IsActive
    };
}
