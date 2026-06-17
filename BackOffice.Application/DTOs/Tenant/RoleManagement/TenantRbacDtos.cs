namespace BackOffice.Application.DTOs.Tenant.RoleManagement
{
    // ───────────────────────────────────────────────
    // Role Grid / Detail / Create / Update DTOs
    // ───────────────────────────────────────────────

    public class RbacTenantRoleGridDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsSystemRole { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public int UserCount { get; set; }
        public int PermissionCount { get; set; }
    }

    public class RbacTenantRoleDetailDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsSystemRole { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? CreatedByUserId { get; set; }
        public List<int> AssignedUserIds { get; set; } = new();
        public List<string> GrantedPermissionKeys { get; set; } = new();
    }

    public class CreateRbacTenantRoleDto
    {
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsSystemRole { get; set; }
    }

    public class UpdateRbacTenantRoleDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsSystemRole { get; set; }
        public bool IsActive { get; set; }
    }

    // ───────────────────────────────────────────────
    // Permission Matrix DTOs
    // ───────────────────────────────────────────────

    /// <summary>
    /// Full permission matrix for a role, grouped by module and screen.
    /// Each permission shows whether it is granted to the role AND whether it falls within the tenant ceiling.
    /// </summary>
    public class RbacTenantRolePermMatrixDto
    {
        public int RoleId { get; set; }
        public string RoleName { get; set; } = null!;
        public List<RbacPermMatrixModuleDto> Modules { get; set; } = new();
    }

    public class RbacPermMatrixModuleDto
    {
        public int ModuleId { get; set; }
        public string? ModuleCode { get; set; }
        public string? ModuleName { get; set; }
        public List<RbacPermMatrixScreenDto> Screens { get; set; } = new();
    }

    public class RbacPermMatrixScreenDto
    {
        public int ScreenId { get; set; }
        public string? ScreenCode { get; set; }
        public string? ScreenName { get; set; }
        public List<RbacPermMatrixItemDto> Permissions { get; set; } = new();
    }

    public class RbacPermMatrixItemDto
    {
        public int PermissionId { get; set; }
        public string PermissionKey { get; set; } = null!;
        public string? PermissionName { get; set; }
        public string? Category { get; set; }
        /// <summary>
        /// Whether this permission is currently granted to the role.
        /// </summary>
        public bool IsGranted { get; set; }
        /// <summary>
        /// Whether this permission is within the tenant's ceiling (allowed by the Master DB).
        /// If false, the permission cannot be granted to any role in this tenant.
        /// </summary>
        public bool IsInCeiling { get; set; }
    }

    public class RbacRolePermissionItem
    {
        public string PermissionKey { get; set; } = null!;
        public bool IsGranted { get; set; }
    }

    // ───────────────────────────────────────────────
    // User-Role Assignment DTOs
    // ───────────────────────────────────────────────

    public class RbacTenantUserRoleDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int RoleId { get; set; }
        public string? RoleName { get; set; }
        public string? RoleCode { get; set; }
        public DateTime AssignedAt { get; set; }
        public int? AssignedByUserId { get; set; }
    }

    public class AssignRbacTenantUserRolesDto
    {
        public int UserId { get; set; }
        public List<int> RoleIds { get; set; } = new();
    }

    /// <summary>
    /// Returns all active roles with assignment status for a given user.
    /// Frontend uses this to display checkboxes for all roles.
    /// </summary>
    public class UserRoleAssignmentDto
    {
        public int RoleId { get; set; }
        public string RoleName { get; set; } = null!;
        public string RoleCode { get; set; } = null!;
        public bool IsAssigned { get; set; }
    }

    // ───────────────────────────────────────────────
    // User Permission Override DTOs
    // ───────────────────────────────────────────────

    public class RbacUserPermOverrideDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string PermissionKey { get; set; } = null!;
        public bool IsGranted { get; set; }
        public string? Reason { get; set; }
        public int? GrantedByUserId { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateRbacUserPermOverrideDto
    {
        public int UserId { get; set; }
        public string PermissionKey { get; set; } = null!;
        public bool IsGranted { get; set; }
        public string? Reason { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }

    // ───────────────────────────────────────────────
    // Admin Initialization DTO
    // ───────────────────────────────────────────────

    /// <summary>
    /// Used by Super Admin to initialize a tenant's Administrator role
    /// with all ceiling permissions and optionally assign a user.
    /// </summary>
    public class InitializeAdminDto
    {
        /// <summary>
        /// The tenant (customer) ID to initialize. Required for Super Admin context.
        /// </summary>
        public int TenantId { get; set; }

        /// <summary>
        /// Optional: The user ID to assign the Administrator role to.
        /// If null, only the role and permissions are set up.
        /// </summary>
        public int? AdminUserId { get; set; }
    }
}
