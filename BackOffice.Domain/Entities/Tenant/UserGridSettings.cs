#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// Stores user-specific grid column settings (visibility, width, order) for persistence
/// </summary>
public class UserGridSettings
{
    /// <summary>
    /// Primary key
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// User ID (from Users table)
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Unique identifier for the grid (e.g., "items-list-grid", "users-list-grid")
    /// </summary>
    public string GridId { get; set; } = null!;

    /// <summary>
    /// JSON string containing column settings (visibility, width, order)
    /// </summary>
    public string SettingsJson { get; set; } = null!;

    /// <summary>
    /// Date when settings were created
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// Date when settings were last modified
    /// </summary>
    public DateTime DateModified { get; set; }
}
