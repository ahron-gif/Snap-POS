using BackOffice.Api.Authorization;
using BackOffice.Api.Services;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.RoleManagement;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// RBAC Phase 2: Tenant-level role and permission management.
    /// Works with permission-key based model and validates against Master DB ceiling.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TenantRbacController : ControllerBase
    {
        private readonly ITenantRbacService _rbacService;
        private readonly IEffectivePermissionBuilder _permissionBuilder;
        private readonly TenantDBContext _tenantDb;
        private readonly ITenantProvider _tenantProvider;

        public TenantRbacController(
            ITenantRbacService rbacService,
            IEffectivePermissionBuilder permissionBuilder,
            TenantDBContext tenantDb,
            ITenantProvider tenantProvider)
        {
            _rbacService = rbacService;
            _permissionBuilder = permissionBuilder;
            _tenantDb = tenantDb;
            _tenantProvider = tenantProvider;
        }

        // ─── Diagnostic ──────────────────────────────────

        /// <summary>
        /// Diagnostic endpoint: checks which tenant DB is connected and if RBAC tables exist.
        /// </summary>
        [HttpGet("Diagnostic")]
        public async Task<IActionResult> Diagnostic()
        {
            try
            {
                var conn = _tenantDb.Database.GetDbConnection();
                var dbName = conn.Database;
                var dataSource = conn.DataSource;

                var tables = new Dictionary<string, bool>();
                var requiredTables = new[] { "RbacTenantRoles", "RbacTenantUserRoles", "RbacTenantRolePermissions",
                    "RbacTenantUserPermOverrides", "RbacTenantConfigs", "RbacTenantAuditLogs" };

                foreach (var table in requiredTables)
                {
                    try
                    {
                        var exists = await _tenantDb.Database.ExecuteSqlRawAsync(
                            $"SELECT TOP 0 * FROM dbo.[{table}]");
                        tables[table] = true;
                    }
                    catch
                    {
                        tables[table] = false;
                    }
                }

                int roleCount = 0;
                try { roleCount = await _tenantDb.RbacTenantRoles.CountAsync(); } catch { }

                return Ok(new
                {
                    database = dbName,
                    server = dataSource,
                    tenantId = GetTenantIdFromClaims(),
                    userId = GetUserIdFromClaims(),
                    tables,
                    roleCount
                });
            }
            catch (Exception ex)
            {
                return Ok(new { error = ex.Message, innerError = ex.InnerException?.Message });
            }
        }

        // ─── Roles ─────────────────────────────────────

        [HttpGet("Roles")]
        [RequirePermission("admin.roles.view")]
        public IActionResult GetRoles([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _rbacService.GetRolesGrid(paginationGridDto);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        [HttpGet("Roles/{id}")]
        [RequirePermission("admin.roles.view")]
        public async Task<IActionResult> GetRole(int id)
        {
            var result = await _rbacService.GetRoleByIdAsync(id);
            if (!result.IsSuccess)
                return NotFound(result);
            return Ok(result);
        }

        [HttpPost("Roles")]
        [RequirePermission("admin.roles.create")]
        public async Task<IActionResult> CreateRole([FromBody] CreateRbacTenantRoleDto dto)
        {
            var userId = GetUserIdFromClaims();
            if (userId <= 0) return Unauthorized();

            var result = await _rbacService.CreateRoleAsync(dto, userId);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        // Inline check used by the Add/Edit Role modal so the user finds out
        // about a duplicate code as soon as the field auto-fills, not after submit.
        [HttpGet("Roles/CodeExists")]
        [RequirePermission("admin.roles.view")]
        public async Task<IActionResult> RoleCodeExists([FromQuery] string code, [FromQuery] int? excludeId = null)
        {
            if (string.IsNullOrWhiteSpace(code))
                return BadRequest("code is required.");

            var result = await _rbacService.RoleCodeExistsAsync(code, excludeId);
            return Ok(result);
        }

        [HttpPut("Roles/{id}")]
        [RequirePermission("admin.roles.edit")]
        public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateRbacTenantRoleDto dto)
        {
            if (id != dto.Id)
                return BadRequest("ID mismatch");

            var result = await _rbacService.UpdateRoleAsync(dto);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        [HttpDelete("Roles/{id}")]
        [RequirePermission("admin.roles.delete")]
        public async Task<IActionResult> DeleteRole(int id)
        {
            var result = await _rbacService.DeleteRoleAsync(id);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        // ─── Role Permissions ──────────────────────────

        [HttpGet("Roles/{id}/PermissionMatrix")]
        [RequirePermission("admin.roles.view")]
        public async Task<IActionResult> GetRolePermissionMatrix(int id)
        {
            var tenantId = GetTenantIdFromClaims();
            if (tenantId <= 0)
                return BadRequest("No tenant context available.");

            var result = await _rbacService.GetRolePermissionMatrixAsync(id, tenantId);
            if (!result.IsSuccess)
                return NotFound(result);
            return Ok(result);
        }
       
        [HttpPut("Roles/{id}/Permissions")]
        [RequirePermission("admin.roles.edit")]
        public async Task<IActionResult> UpdateRolePermissions(int id, [FromBody] List<RbacRolePermissionItem> permissions)
        {
            var tenantId = GetTenantIdFromClaims();
            if (tenantId <= 0)
                return BadRequest("No tenant context available.");

            var result = await _rbacService.UpdateRolePermissionsAsync(id, permissions, tenantId);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);

            // Invalidate tenant cache since role permissions changed
            _permissionBuilder.InvalidateTenantCache(tenantId);

            return Ok(result);
        }

        // ─── User-Role Assignment ─────────────────────

        [HttpGet("Users/{userId}/Roles")]
        [RequirePermission("admin.user_roles.view")]
        public async Task<IActionResult> GetUserRoles(int userId)
        {
            // Returns all active roles with isAssigned flag for the user
            var result = await _rbacService.GetUserRoleAssignmentsAsync(userId);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        [HttpPut("Users/{userId}/Roles")]
        [RequirePermission("admin.user_roles.edit")]
        public async Task<IActionResult> AssignUserRoles(int userId, [FromBody] AssignRbacTenantUserRolesDto dto)
        {
            if (userId != dto.UserId)
                return BadRequest("User ID mismatch");

            var assignedBy = GetUserIdFromClaims();
            if (assignedBy <= 0) return Unauthorized();

            var tenantId = GetTenantIdFromClaims();

            var result = await _rbacService.AssignUserRolesAsync(userId, dto.RoleIds, assignedBy);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);

            // Invalidate user permission cache
            if (tenantId > 0)
                _permissionBuilder.InvalidateUserCache(userId, tenantId);

            return Ok(result);
        }

        // ─── User Permission Overrides ────────────────

        [HttpGet("Users/{userId}/Overrides")]
        [RequirePermission("admin.user_roles.view")]
        public async Task<IActionResult> GetUserPermOverrides(int userId)
        {
            var result = await _rbacService.GetUserPermOverridesAsync(userId);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        [HttpPost("Users/Overrides")]
        [RequirePermission("admin.user_roles.edit")]
        public async Task<IActionResult> CreateUserPermOverride([FromBody] CreateRbacUserPermOverrideDto dto)
        {
            var tenantId = GetTenantIdFromClaims();
            if (tenantId <= 0)
                return BadRequest("No tenant context available.");

            var result = await _rbacService.CreateUserPermOverrideAsync(dto, tenantId);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);

            // Invalidate user permission cache
            _permissionBuilder.InvalidateUserCache(dto.UserId, tenantId);

            return Ok(result);
        }

        [HttpDelete("Users/Overrides/{id}")]
        [RequirePermission("admin.user_roles.edit")]
        public async Task<IActionResult> DeleteUserPermOverride(int id)
        {
            var result = await _rbacService.DeleteUserPermOverrideAsync(id);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        // ─── Admin Initialization ────────────────────

        /// <summary>
        /// Initializes the tenant's Administrator role with all ceiling permissions.
        /// Called by Super Admin after configuring the tenant's permission ceiling.
        /// Optionally assigns a user to the admin role.
        /// </summary>
        [HttpPost("InitializeAdmin")]
        public async Task<IActionResult> InitializeAdmin([FromBody] InitializeAdminDto dto)
        {
            var tenantId = dto.TenantId > 0 ? dto.TenantId : GetTenantIdFromClaims();
            if (tenantId <= 0)
                return BadRequest("No tenant context available.");

            var result = await _rbacService.InitializeAdminRoleAsync(tenantId, dto.AdminUserId);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);

            // Invalidate tenant ceiling cache since permissions changed
            _permissionBuilder.InvalidateTenantCache(tenantId);

            // Also invalidate the specific user's permission cache if a user was assigned
            if (dto.AdminUserId.HasValue && dto.AdminUserId.Value > 0)
            {
                _permissionBuilder.InvalidateUserCache(dto.AdminUserId.Value, tenantId);
            }

            return Ok(result);
        }

        /// <summary>
        /// Idempotently seeds the standard operational roles into the current tenant
        /// (resolved from the CustomerId header/claims). Use this to backfill an
        /// existing tenant — safe to call repeatedly; already-present roles are skipped.
        /// </summary>
        [HttpPost("SeedDefaultRoles")]
        public async Task<IActionResult> SeedDefaultRoles()
        {
            var tenantId = GetTenantIdFromClaims();
            if (tenantId <= 0)
                return BadRequest("No tenant context available.");

            var userId = GetUserIdFromClaims();
            var result = await _rbacService.SeedDefaultRolesAsync(tenantId, userId > 0 ? userId : (int?)null);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        // ─── Private Helpers ──────────────────────────

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }

        private int GetTenantIdFromClaims()
        {
            var headerValue = HttpContext.Request.Headers["CustomerId"].ToString();
            if (!string.IsNullOrEmpty(headerValue) && int.TryParse(headerValue, out var headerCustomerId) && headerCustomerId > 0)
                return headerCustomerId;

            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (int.TryParse(customerIdClaim, out var customerId) && customerId > 0)
                return customerId;

            return _tenantProvider.GetCustomerId() ?? 0;
        }
    }
}
