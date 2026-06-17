#nullable enable
using System;
using System.Collections.Generic;

namespace BackOffice.Domain.Entities.Tenant;

// Legacy entity for the original tenant [Users] table.
// Kept live in the codebase so EF Core can register the legacy DbSet
// (TenantDBContext.Users) and so other tenant entities such as Template
// and the legacy UsersStore can keep their navigation properties resolving.
// New web flows go through WebUser; do not consume this type in new code.
public partial class User
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

    public virtual ICollection<Template> Templates { get; set; } = new List<Template>();

    public virtual ICollection<UsersStore> UsersStores { get; set; } = new List<UsersStore>();
}
