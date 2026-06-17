#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class GlobalRoleScreenAction
{
    public int GlobalRoleScreenActionId { get; set; }

    public int GlobalRoleId { get; set; }

    public int ScreenActionId { get; set; }

    public bool IsAllowed { get; set; }

    public virtual GlobalRole GlobalRole { get; set; } = null!;

    public virtual ScreenAction ScreenAction { get; set; } = null!;
}
