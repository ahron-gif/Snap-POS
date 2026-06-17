namespace BackOffice.Application.DTOs.Environments;

// ─── Environment CRUD ─────────────────────────────────────────────────────────

public class EnvironmentDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Code { get; set; } = null!;
    public bool IsActive { get; set; }
}

public class CreateEnvironmentDto
{
    public string Name { get; set; } = null!;
    public string Code { get; set; } = null!;
    public bool IsActive { get; set; } = true;
}

public class UpdateEnvironmentDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Code { get; set; } = null!;
    public bool IsActive { get; set; }
}

// ─── User-Environment Assignments ─────────────────────────────────────────────

public class UserEnvironmentDto
{
    public Guid Id { get; set; }
    public int UserId { get; set; }
    public int CustomerId { get; set; }
    public Guid EnvironmentId { get; set; }
    public string EnvironmentName { get; set; } = null!;
    public string EnvironmentCode { get; set; } = null!;
}

/// <summary>
/// Replaces all environment assignments for a user+customer in one call,
/// and also sets the HasWebAccess flag on the user.
/// </summary>
public class SetUserEnvironmentsDto
{
    public int UserId { get; set; }
    public int CustomerId { get; set; }

    /// <summary>IDs of environments this user is allowed to access.</summary>
    public List<Guid> EnvironmentIds { get; set; } = [];

    /// <summary>Whether this user may access the web backoffice at all.</summary>
    public bool HasWebAccess { get; set; }
}

/// <summary>
/// Returned by GET user/{userId}/customer/{customerId}/full so the form can
/// pre-populate both the HasWebAccess toggle and the environments multi-select.
/// </summary>
public class UserEnvironmentAccessDto
{
    public bool HasWebAccess { get; set; }
    public List<UserEnvironmentDto> Environments { get; set; } = [];
}
