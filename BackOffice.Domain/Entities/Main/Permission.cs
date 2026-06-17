#nullable enable
using System;
using System.Collections.Generic;

namespace BackOffice.Domain.Entities.Main;

public partial class Permission
{
    public int Id { get; set; }

    public int ModuleId { get; set; }

    public int? ScreenId { get; set; }

    /// <summary>
    /// Dot-notation key, e.g. "sales.invoice.view", "sales.invoice.create"
    /// </summary>
    public string PermissionKey { get; set; } = null!;

    public string Name { get; set; } = null!;

    /// <summary>
    /// Category: "action", "field", "data", "report"
    /// </summary>
    public string Category { get; set; } = null!;

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Module Module { get; set; } = null!;

    public virtual Screen? Screen { get; set; }

    public virtual ICollection<TenantAllowedPermission> TenantAllowedPermissions { get; set; } = new List<TenantAllowedPermission>();
}
