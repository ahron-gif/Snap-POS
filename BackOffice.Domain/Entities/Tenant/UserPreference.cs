#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// Stores user-specific preferences as key-value pairs with JSON values
/// </summary>
public class UserPreference
{
    /// <summary>
    /// Primary key
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// User ID (LocalUserId from JWT - tenant-specific)
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Unique preference key (e.g., "lastSession", "workspaceState")
    /// </summary>
    public string PreferenceKey { get; set; } = null!;

    /// <summary>
    /// JSON string containing the preference value
    /// </summary>
    public string PreferenceValue { get; set; } = null!;

    /// <summary>
    /// Date when preference was created
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// Date when preference was last modified
    /// </summary>
    public DateTime DateModified { get; set; }
}
