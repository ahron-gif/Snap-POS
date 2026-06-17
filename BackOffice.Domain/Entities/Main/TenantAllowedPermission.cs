#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class TenantAllowedPermission
{
    public int Id { get; set; }

    public int TenantId { get; set; }

    public int PermissionId { get; set; }

    public bool IsAllowed { get; set; }

    public int? GrantedByUserId { get; set; }

    public DateTime GrantedAt { get; set; }

    public virtual Customer Tenant { get; set; } = null!;

    public virtual Permission Permission { get; set; } = null!;
}
