using BackOffice.Application.DTOs.Environments;

namespace BackOffice.Application.Interfaces.Services.Main;

public interface IEnvironmentAccessService
{
    // ─── Environment CRUD ─────────────────────────────────────────────────
    Task<List<EnvironmentDto>> GetAllEnvironmentsAsync();
    Task<EnvironmentDto?> GetEnvironmentByIdAsync(Guid id);
    Task<EnvironmentDto> CreateEnvironmentAsync(CreateEnvironmentDto dto);
    Task<EnvironmentDto?> UpdateEnvironmentAsync(UpdateEnvironmentDto dto);
    Task<bool> DeleteEnvironmentAsync(Guid id);

    // ─── User-Environment Assignments ─────────────────────────────────────
    Task<UserEnvironmentAccessDto> GetUserEnvironmentAccessAsync(int userId, int customerId);
    Task SetUserEnvironmentsAsync(SetUserEnvironmentsDto dto);

    // ─── Access Checks (used by middleware + login) ────────────────────────
    /// <summary>Returns false if the user's HasWebAccess flag is false.</summary>
    Task<bool> HasWebAccessAsync(int userId);

    /// <summary>
    /// Returns true when the user has a UserEnvironments row matching
    /// (UserId, CustomerId, EnvironmentCode) for an active environment.
    /// SuperAdmins (IsSuperAdmin = true) always return true.
    /// </summary>
    Task<bool> HasEnvironmentAccessAsync(int userId, int customerId, string environmentCode);

    /// <summary>
    /// Returns true when the user has a UserEnvironments row matching
    /// (UserId, CustomerId, EnvironmentId) directly by GUID.
    /// SuperAdmins (IsSuperAdmin = true) always return true.
    /// </summary>
    Task<bool> HasEnvironmentAccessByIdAsync(int userId, int customerId, Guid environmentId);

    /// <summary>Evicts per-user cache entries after an assignment change.</summary>
    void InvalidateUserAccessCache(int userId, int customerId, IEnumerable<Guid>? envIds = null);
}
