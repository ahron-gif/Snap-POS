#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// RBAC Phase 2: Maps a user (by int UserId from MainDB) to a tenant RBAC role.
/// </summary>
public partial class RbacTenantUserRole
{
    public int Id { get; set; }

    /// <summary>
    /// The UserId from MainDB AppUsers table.
    /// </summary>
    public int UserId { get; set; }

    public int RoleId { get; set; }

    public DateTime AssignedAt { get; set; }

    public int? AssignedByUserId { get; set; }

    public virtual RbacTenantRole Role { get; set; } = null!;
}
