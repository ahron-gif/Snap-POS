#nullable enable
namespace BackOffice.Domain.Entities.Main;

/// <summary>
/// Represents a deployment environment (Dev, QA, UAT, Prod).
/// Access to this backoffice application is gated per environment.
/// </summary>
public class AppEnvironment
{
    public Guid Id { get; set; }

    /// <summary>Human-readable name, e.g. "Quality Assurance"</summary>
    public string Name { get; set; } = null!;

    /// <summary>Short uppercase code, e.g. "QA". Matched against appsettings CurrentEnvironment.</summary>
    public string Code { get; set; } = null!;

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    // Navigation
    public ICollection<UserEnvironment> UserEnvironments { get; set; } = [];
}
