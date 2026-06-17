using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class Permission
{
    public int Id { get; set; }

    public string PermissionKey { get; set; } = null!;

    public string PermissionName { get; set; } = null!;

    public string? Description { get; set; }

    public string? Category { get; set; }

    public bool IsActive { get; set; }

    public DateTime? DateCreated { get; set; }

    public DateTime? DateModified { get; set; }

    public string? CreatedBy { get; set; }

    public string? ModifiedBy { get; set; }

    public virtual ICollection<TokenPermission> TokenPermissions { get; set; } = new List<TokenPermission>();
}
