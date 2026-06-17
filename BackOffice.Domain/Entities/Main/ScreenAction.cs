#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class ScreenAction
{
    public int ScreenActionId { get; set; }

    public int ModuleId { get; set; }

    public string ActionKey { get; set; } = null!;

    public string ActionName { get; set; } = null!;

    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    public DateTime DateCreated { get; set; }

    public DateTime? DateModified { get; set; }

    public virtual Module Module { get; set; } = null!;
}
