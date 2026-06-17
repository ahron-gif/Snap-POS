using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.RoleManagement;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    /// <summary>
    /// RBAC Phase 2: Comprehensive tenant role + permission management service.
    /// Works with permission-key based model and validates against Master DB ceiling.
    /// </summary>
    public interface ITenantRbacService
    {
        // ─── Roles ─────────────────────────────────────
        ApiResponse<PaginationResponseDTO<RbacTenantRoleGridDto>> GetRolesGrid(PaginationGridDto paginationGridDto);
        Task<ApiResponse<RbacTenantRoleDetailDto>> GetRoleByIdAsync(int id);
        Task<ApiResponse<int>> CreateRoleAsync(CreateRbacTenantRoleDto dto, int createdByUserId);
        Task<ApiResponse<bool>> UpdateRoleAsync(UpdateRbacTenantRoleDto dto);
        Task<ApiResponse<bool>> DeleteRoleAsync(int id);

        /// <summary>
        /// Returns true when an active role with the given code already exists.
        /// Used by the Add/Edit Role modal for inline duplicate-code validation.
        /// </summary>
        /// <param name="code">Role code to check (already normalized to UPPER_SNAKE on the client).</param>
        /// <param name="excludeId">Optional role id to exclude — for the Edit flow so a role doesn't conflict with itself.</param>
        Task<ApiResponse<bool>> RoleCodeExistsAsync(string code, int? excludeId = null);

        // ─── Role Permissions ──────────────────────────
        /// <summary>
        /// Gets the full permission matrix for a role, including ceiling info from Master DB.
        /// </summary>
        Task<ApiResponse<RbacTenantRolePermMatrixDto>> GetRolePermissionMatrixAsync(int roleId, int tenantId);

        /// <summary>
        /// Updates permissions for a role. Validates each permission against the tenant ceiling.
        /// Rejects any permission not within the ceiling.
        /// </summary>
        Task<ApiResponse<bool>> UpdateRolePermissionsAsync(int roleId, List<RbacRolePermissionItem> permissions, int tenantId);

        // ─── User-Role Assignment ─────────────────────
        Task<ApiResponse<List<RbacTenantUserRoleDto>>> GetUserRolesAsync(int userId);
        /// <summary>
        /// Returns all active roles with assignment status for a user (for the role assignment UI).
        /// </summary>
        Task<ApiResponse<List<UserRoleAssignmentDto>>> GetUserRoleAssignmentsAsync(int userId);
        Task<ApiResponse<bool>> AssignUserRolesAsync(int userId, List<int> roleIds, int assignedBy);

        // ─── User Permission Overrides ────────────────
        Task<ApiResponse<List<RbacUserPermOverrideDto>>> GetUserPermOverridesAsync(int userId);
        Task<ApiResponse<int>> CreateUserPermOverrideAsync(CreateRbacUserPermOverrideDto dto, int tenantId);
        Task<ApiResponse<bool>> DeleteUserPermOverrideAsync(int id);

        // ─── Admin Initialization ────────────────────
        /// <summary>
        /// Initializes the Administrator role for a tenant with all ceiling permissions.
        /// Optionally assigns a user to the admin role.
        /// </summary>
        Task<ApiResponse<bool>> InitializeAdminRoleAsync(int tenantId, int? adminUserId);

        /// <summary>
        /// Idempotently seeds the standard operational roles (see DefaultTenantRoles)
        /// into the current tenant. Roles are created empty (admin assigns permissions
        /// later); existing roles are skipped. Returns the number of roles created.
        /// Called during onboarding and usable to backfill an existing tenant.
        /// </summary>
        Task<ApiResponse<int>> SeedDefaultRolesAsync(int tenantId, int? createdByUserId);
    }
}
