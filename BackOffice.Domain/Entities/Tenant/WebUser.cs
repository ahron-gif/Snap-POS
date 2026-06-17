#nullable enable
using System;
using System.Collections.Generic;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// Web-specific tenant user. Maps to the [WebUsers] table.
/// Mirrors the legacy <see cref="User"/> entity exactly. The legacy
/// <see cref="User"/> entity is retained for the desktop POS code path
/// and any future need.
/// </summary>
public partial class WebUser
{
    public Guid UserId { get; set; }

    public string? UserName { get; set; }

    public string? Password { get; set; }

    public string? PasswordHash { get; set; }

    public string? UserFName { get; set; }

    public string? UserLName { get; set; }

    public string? Address { get; set; }

    public string? HomePhoneNumber { get; set; }

    public string? WorkPhoneNumber { get; set; }

    public string? Fax { get; set; }

    public string? Email { get; set; }

    public string? ZipCode { get; set; }

    public bool? IsSuperAdmin { get; set; }

    public short? Status { get; set; }

    public DateTime? DateCreated { get; set; }

    public Guid? UserCreated { get; set; }

    public DateTime? DateModified { get; set; }

    public Guid? UserModified { get; set; }

    public string? ScanID { get; set; }

    public bool? IsLogIn { get; set; }

    public virtual ICollection<WebUsersStore> WebUsersStores { get; set; } = new List<WebUsersStore>();
}
