using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.User
{
    public class CreateUserDto
    {
        public string UserName { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string? UserFName { get; set; }
        public string? UserLName { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? HomePhoneNumber { get; set; }
        public string? WorkPhoneNumber { get; set; }
        public string? Fax { get; set; }
        public string? ZipCode { get; set; }
        public bool IsSuperAdmin { get; set; }
        public List<Guid>? StoreIds { get; set; }
        public Guid? DefaultStoreId { get; set; }
        public Guid? GroupId { get; set; }

        // ── Role + tenant assignments (atomic creation) ─────────────────────
        // Role ids the new user should be assigned to. At least one is required
        // (enforced by validator + service). When any assigned role is flagged
        // IsSuperAdmin in the Role table, the tenant / store rules below are
        // skipped — super-admin users have implicit access.
        public List<int>? RoleIds { get; set; }
        // Tenant (customer) ids the new user should belong to. Required when
        // the user has no super-admin role. Only populated by super-admin
        // operators; regular admins inherit the current tenant context.
        public List<int>? CustomerIds { get; set; }
    }

    public class UpdateUserDto
    {
        public Guid TenantUserId { get; set; }
        public string UserName { get; set; } = null!;
        public string? Password { get; set; }
        public string? UserFName { get; set; }
        public string? UserLName { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? HomePhoneNumber { get; set; }
        public string? WorkPhoneNumber { get; set; }
        public string? Fax { get; set; }
        public string? ZipCode { get; set; }
        public bool IsSuperAdmin { get; set; }
        public List<Guid>? StoreIds { get; set; }
        public Guid? DefaultStoreId { get; set; }
        public Guid? GroupId { get; set; }

        // ── Role + tenant assignments (atomic update) ───────────────────────
        // See CreateUserDto for semantics. Same validation rules apply on edit
        // so a user can't be saved into a broken state.
        public List<int>? RoleIds { get; set; }
        public List<int>? CustomerIds { get; set; }
    }

    public class UserDetailDto
    {
        public Guid TenantUserId { get; set; }
        public int MainUserId { get; set; }
        public string UserName { get; set; } = null!;
        public string? UserFName { get; set; }
        public string? UserLName { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? HomePhoneNumber { get; set; }
        public string? WorkPhoneNumber { get; set; }
        public string? Fax { get; set; }
        public string? ZipCode { get; set; }
        public bool? IsSuperAdmin { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public int? CustomerId { get; set; }
        public string? Phone { get; set; }
        public List<UserStoreAssignmentDto> AssignedStores { get; set; } = new();
        public Guid? GroupId { get; set; }
    }

    public class UserStoreAssignmentDto
    {
        public Guid StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public bool IsDefault { get; set; }
        public bool IsManager { get; set; }
    }
}
