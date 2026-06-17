#nullable enable
namespace BackOffice.Domain.Entities.Main;

/// <summary>
/// Maps a user (within a specific customer context) to the environments they are
/// allowed to access. Unique constraint: (UserId, EnvironmentId, CustomerId).
/// </summary>
public class UserEnvironment
{
    public Guid Id { get; set; }

    /// <summary>FK → WebAppUser.UserId</summary>
    public int UserId { get; set; }

    /// <summary>Tenant / customer context for this mapping.</summary>
    public int CustomerId { get; set; }

    /// <summary>FK → AppEnvironment.Id</summary>
    public Guid EnvironmentId { get; set; }

    public DateTime CreatedAt { get; set; }

    // Navigation
    public WebAppUser User { get; set; } = null!;
    public AppEnvironment Environment { get; set; } = null!;
}
