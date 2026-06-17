#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// RBAC Phase 2: Key-value configuration store for tenant-level RBAC settings.
/// </summary>
public partial class RbacTenantConfigEntry
{
    public int Id { get; set; }

    public string ConfigKey { get; set; } = null!;

    public string? ConfigValue { get; set; }

    public DateTime UpdatedAt { get; set; }
}
