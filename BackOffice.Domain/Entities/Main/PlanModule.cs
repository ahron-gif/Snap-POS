#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class PlanModule
{
    public int Id { get; set; }

    public int PlanId { get; set; }

    public int ModuleId { get; set; }

    public bool IsEnabled { get; set; }

    public virtual Plan Plan { get; set; } = null!;

    public virtual Module Module { get; set; } = null!;
}
