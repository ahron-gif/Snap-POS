#nullable enable
using System;
using BackOffice.Domain.Attributes;

namespace BackOffice.Domain.Entities.Tenant;

[NotAudited]
public partial class RbacTenantAuditLogEntry
{
    public long Id { get; set; }

    /// <summary>
    /// The UserId from MainDB AppUsers table who performed the action.
    /// </summary>
    public int? UserId { get; set; }

    /// <summary>
    /// The action performed, e.g. "CreateRole", "AssignPermission", "DeleteOverride"
    /// </summary>
    public string Action { get; set; } = null!;

    /// <summary>
    /// The entity type affected, e.g. "RbacTenantRole", "RbacTenantRolePermission"
    /// </summary>
    public string? EntityType { get; set; }

    /// <summary>
    /// The ID of the affected entity (string to accommodate different key types).
    /// </summary>
    public string? EntityId { get; set; }

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; }
}
