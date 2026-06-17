#nullable enable
using System;
using System.Collections.Generic;

namespace BackOffice.Domain.Entities.Main;

public partial class GlobalRole
{
    public int GlobalRoleId { get; set; }

    public string RoleName { get; set; } = null!;

    public string RoleLevel { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime DateCreated { get; set; }

    public DateTime? DateModified { get; set; }

    public int? CreatedBy { get; set; }

    public virtual ICollection<GlobalRoleScreenAction> GlobalRoleScreenActions { get; set; } = new List<GlobalRoleScreenAction>();

    public virtual ICollection<CustomerGlobalRole> CustomerGlobalRoles { get; set; } = new List<CustomerGlobalRole>();

    public virtual ICollection<AppUserGlobalRole> AppUserGlobalRoles { get; set; } = new List<AppUserGlobalRole>();
}
