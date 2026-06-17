#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

/// <summary>
/// Web-specific application user. Maps to the [WebAppUsers] table.
/// Mirrors <see cref="AppUser"/> exactly. The legacy <see cref="AppUser"/>
/// entity remains available for any future use; all current web flows go
/// through this entity.
/// </summary>
public partial class WebAppUser
{
    public int UserId { get; set; }

    public string UserName { get; set; } = null!;

    public string Password { get; set; } = null!;

    public string? PasswordHash { get; set; }

    public string? APIToken { get; set; }

    public string? Email { get; set; }

    public DateTime? LastLoginDate { get; set; }

    public Guid LocalUserId { get; set; }

    public DateTime DateCreated { get; set; }

    public DateTime? DateModified { get; set; }

    public int? SystemUserCreated { get; set; }

    public int? CustomerId { get; set; }

    public string? Phone { get; set; }

    public int InviteStatus { get; set; }

    public string? LoginType { get; set; }

    public string? UserFName { get; set; }

    public string? UserLName { get; set; }

    public string? Address { get; set; }

    public string? WorkPhoneNumber { get; set; }

    public string? Fax { get; set; }

    public string? ZipCode { get; set; }

    public bool? IsSuperAdmin { get; set; }

    public short? Status { get; set; }

    public Guid? UserCreated { get; set; }

    public Guid? UserModified { get; set; }

    public string? ScanID { get; set; }

    public bool? IsLogIn { get; set; }

    public bool HasWebAccess { get; set; }

    /// <summary>
    /// S3 object key / path for the user's profile picture. Web-only concept —
    /// stored ONLY on this app-user table, never mirrored to the tenant user
    /// tables or the legacy desktop AppUser. A pre-signed URL is generated from
    /// this key on read (see UserController.GetMyProfile / UploadProfileImage).
    /// Null when the user has no profile image.
    /// </summary>
    public string? ProfileImage { get; set; }
}
