#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class TenantAllowedModule
{
    public int Id { get; set; }

    public int TenantId { get; set; }

    public int ModuleId { get; set; }

    public bool IsEnabled { get; set; }

    public DateTime EnabledAt { get; set; }

    public DateTime? DisabledAt { get; set; }

    public virtual Customer Tenant { get; set; } = null!;

    public virtual Module Module { get; set; } = null!;
}
