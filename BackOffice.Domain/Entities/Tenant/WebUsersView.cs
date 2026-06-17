#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// Read-only projection over [WebUsers] / [WebUsersStore] / [Store] / [Groups].
/// Mirrors <see cref="UsersView"/>.
/// </summary>
public partial class WebUsersView
{
    public Guid UserId { get; set; }

    public string? UserName { get; set; }

    public string? Password { get; set; }

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

    public Guid? GroupID { get; set; }

    public bool? Manager { get; set; }

    public bool? IsDefault { get; set; }

    public Guid? StoreID { get; set; }

    public DateTime? UserStoreDateM { get; set; }

    public string? ScanID { get; set; }

    public string? GroupName { get; set; }

    public string? StoreName { get; set; }

    public bool? IsLogIn { get; set; }
}
