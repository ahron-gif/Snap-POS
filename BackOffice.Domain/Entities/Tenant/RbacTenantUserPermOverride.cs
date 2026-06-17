#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// RBAC Phase 2: Per-user permission override that takes precedence over role-based permissions.
/// Allows granting or revoking a specific permission for a specific user.
/// </summary>
public partial class RbacTenantUserPermOverride
{
    public int Id { get; set; }

    /// <summary>
    /// The UserId from MainDB AppUsers table.
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// Dot-notation permission key, e.g. "sales.invoice.approve"
    /// </summary>
    public string PermissionKey { get; set; } = null!;

    public bool IsGranted { get; set; }

    public string? Reason { get; set; }

    public int? GrantedByUserId { get; set; }

    /// <summary>
    /// Optional expiration date. Null means the override never expires.
    /// </summary>
    public DateTime? ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
