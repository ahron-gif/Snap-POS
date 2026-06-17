#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

// Legacy entity for the original [AppUsers] table.
// Kept live in the codebase so the existing DbSet<AppUser> registration on
// MainDBContext keeps mapping to the legacy table. New web flows go through
// WebAppUser; do not consume this type in new code.
public partial class AppUser
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

    // When false this user is denied access to the web backoffice application entirely,
    // regardless of their environment assignments. Defaults to true (DB default = 1).
    public bool HasWebAccess { get; set; }
}
