#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class AppUserGlobalRole
{
    public int AppUserGlobalRoleId { get; set; }

    public int UserId { get; set; }

    public int GlobalRoleId { get; set; }

    public DateTime DateAssigned { get; set; }

    public int? AssignedBy { get; set; }

    public virtual WebAppUser WebAppUser { get; set; } = null!;

    public virtual GlobalRole GlobalRole { get; set; } = null!;
}
