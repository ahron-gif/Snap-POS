#nullable enable
using System;
using System.Collections.Generic;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// Web-specific user-store mapping. Maps to the [WebUsersStore] table.
/// Mirrors <see cref="UsersStore"/> exactly. The legacy entity is retained.
/// </summary>z
public partial class WebUsersStore
{
    public Guid UserStoreID { get; set; }

    public Guid? UserID { get; set; }

    public bool? OnLine { get; set; }

    public Guid? StoreID { get; set; }

    public bool? IsDefault { get; set; }

    public Guid? GroupID { get; set; }

    public bool? Manager { get; set; }

    public DateTime? LogonDate { get; set; }

    public short? Status { get; set; }

    public DateTime? DateCreated { get; set; }

    public Guid? UserCreated { get; set; }

    public DateTime? DateModified { get; set; }

    public Guid? UserModified { get; set; }

    public virtual WebUser? WebUser { get; set; }
}
