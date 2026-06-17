#nullable enable
using System;
using System.Collections.Generic;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// RBAC Phase 2: Tenant-level role with permission-key based assignments.
/// Separate from legacy TenantRole which uses Guid IDs and screen-action model.
/// </summary>
public partial class RbacTenantRole
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsSystemRole { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public int? CreatedByUserId { get; set; }

    public virtual ICollection<RbacTenantUserRole> UserRoles { get; set; } = new List<RbacTenantUserRole>();

    public virtual ICollection<RbacTenantRolePermission> RolePermissions { get; set; } = new List<RbacTenantRolePermission>();
}
