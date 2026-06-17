#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// RBAC Phase 2: Maps a permission key (dot-notation, e.g. "sales.invoice.view") to a tenant role.
/// </summary>
public partial class RbacTenantRolePermission
{
    public int Id { get; set; }

    public int RoleId { get; set; }

    /// <summary>
    /// Dot-notation permission key, e.g. "sales.invoice.view"
    /// Must match Permission.PermissionKey in MainDB.
    /// </summary>
    public string PermissionKey { get; set; } = null!;

    public bool IsGranted { get; set; }

    public virtual RbacTenantRole Role { get; set; } = null!;
}
