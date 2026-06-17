#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// Read-only projection over [WebUsersStore] / [WebUsers].
/// Mirrors <see cref="UsersStoreView"/>.
/// </summary>
public partial class WebUsersStoreView
{
    public Guid UserStoreID { get; set; }

    public Guid? UserID { get; set; }

    public bool? OnLine { get; set; }

    public Guid? StoreID { get; set; }

    public bool? IsDefault { get; set; }

    public Guid? GroupID { get; set; }

    public bool? Manager { get; set; }

    public DateTime? LogonDate { get; set; }

    public DateTime? DateCreated { get; set; }

    public Guid? UserCreated { get; set; }

    public DateTime? DateModified { get; set; }

    public Guid? UserModified { get; set; }

    public string? UserName { get; set; }

    public string NAME { get; set; } = null!;

    public short? Status { get; set; }
}
