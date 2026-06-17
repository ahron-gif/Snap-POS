using BackOffice.Application.Constants;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.RoleManagement;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class TenantRbacService : ITenantRbacService
    {
        private readonly TenantDBContext _tenantDb;
        private readonly MainDBContext _mainDb;
        private readonly ILogger<TenantRbacService> _logger;

        public TenantRbacService(
            TenantDBContext tenantDb,
            MainDBContext mainDb,
            ILogger<TenantRbacService> logger)
        {
            _tenantDb = tenantDb;
            _mainDb = mainDb;
            _logger = logger;
        }

        // ───────────────────────────────────────────────
        // Roles
        // ───────────────────────────────────────────────

        public ApiResponse<PaginationResponseDTO<RbacTenantRoleGridDto>> GetRolesGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                var filters = new List<PaginationGridFilterDto>();
                if (!string.IsNullOrEmpty(paginationGridDto.Filters) &&
                    CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _tenantDb.RbacTenantRoles
                    .Where(x => x.IsActive)
                    .Select(x => new RbacTenantRoleGridDto
                    {
                        Id = x.Id,
                        Name = x.Name,
                        Code = x.Code,
                        Description = x.Description,
                        IsSystemRole = x.IsSystemRole,
                        IsActive = x.IsActive,
                        CreatedAt = x.CreatedAt,
                        UserCount = x.UserRoles.Count,
                        PermissionCount = x.RolePermissions.Count(p => p.IsGranted)
                    }).AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var totalRecords = _tenantDb.RbacTenantRoles.Count(x => x.IsActive);
                var filteredRecords = query.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "Name", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                return ApiResponseFactory.Success(new PaginationResponseDTO<RbacTenantRoleGridDto>
                {
                    Data = paginatedData,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow / Math.Max(paginationGridDto.EndRow - paginationGridDto.StartRow, 1),
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching RBAC tenant roles grid");
                return ApiResponseFactory.InternalError<PaginationResponseDTO<RbacTenantRoleGridDto>>(
                    "Error fetching roles.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<RbacTenantRoleDetailDto>> GetRoleByIdAsync(int id)
        {
            try
            {
                var entity = await _tenantDb.RbacTenantRoles
                    .Include(x => x.UserRoles)
                    .Include(x => x.RolePermissions)
                    .FirstOrDefaultAsync(x => x.Id == id);

                if (entity == null)
                    return ApiResponseFactory.NotFound<RbacTenantRoleDetailDto>("Role not found.");

                var dto = new RbacTenantRoleDetailDto
                {
                    Id = entity.Id,
                    Name = entity.Name,
                    Code = entity.Code,
                    Description = entity.Description,
                    IsSystemRole = entity.IsSystemRole,
                    IsActive = entity.IsActive,
                    CreatedAt = entity.CreatedAt,
                    CreatedByUserId = entity.CreatedByUserId,
                    AssignedUserIds = entity.UserRoles.Select(x => x.UserId).ToList(),
                    GrantedPermissionKeys = entity.RolePermissions
                        .Where(x => x.IsGranted)
                        .Select(x => x.PermissionKey)
                        .ToList()
                };

                return ApiResponseFactory.Success(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching RBAC tenant role {Id}", id);
                return ApiResponseFactory.InternalError<RbacTenantRoleDetailDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> RoleCodeExistsAsync(string code, int? excludeId = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(code))
                    return ApiResponseFactory.Success(false, "Code is empty.");

                var query = _tenantDb.RbacTenantRoles
                    .Where(x => x.Code == code && x.IsActive);

                if (excludeId.HasValue)
                    query = query.Where(x => x.Id != excludeId.Value);

                var exists = await query.AnyAsync();
                return ApiResponseFactory.Success(exists, exists ? "Code already in use." : "Code is available.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking role code existence");
                return ApiResponseFactory.InternalError<bool>($"Error checking role code: {ex.Message}");
            }
        }

        public async Task<ApiResponse<int>> CreateRoleAsync(CreateRbacTenantRoleDto dto, int createdByUserId)
        {
            try
            {
                var exists = await _tenantDb.RbacTenantRoles
                    .AnyAsync(x => x.Code == dto.Code && x.IsActive);
                if (exists)
                    return ApiResponseFactory.BadRequest<int>($"Role with code '{dto.Code}' already exists.");

                var entity = new RbacTenantRole
                {
                    Name = dto.Name,
                    Code = dto.Code,
                    Description = dto.Description,
                    IsSystemRole = dto.IsSystemRole,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = createdByUserId
                };

                _tenantDb.RbacTenantRoles.Add(entity);
                await _tenantDb.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.Id, "Role created successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating RBAC tenant role");
                return ApiResponseFactory.InternalError<int>($"Error creating role: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdateRoleAsync(UpdateRbacTenantRoleDto dto)
        {
            try
            {
                var entity = await _tenantDb.RbacTenantRoles.FindAsync(dto.Id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Role not found.");

                var duplicate = await _tenantDb.RbacTenantRoles
                    .AnyAsync(x => x.Code == dto.Code && x.IsActive && x.Id != dto.Id);
                if (duplicate)
                    return ApiResponseFactory.BadRequest<bool>($"Role with code '{dto.Code}' already exists.");

                entity.Name = dto.Name;
                entity.Code = dto.Code;
                entity.Description = dto.Description;
                entity.IsSystemRole = dto.IsSystemRole;
                entity.IsActive = dto.IsActive;

                await _tenantDb.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Role updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating RBAC tenant role {Id}", dto.Id);
                return ApiResponseFactory.InternalError<bool>($"Error updating role: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteRoleAsync(int id)
        {
            try
            {
                var entity = await _tenantDb.RbacTenantRoles.FindAsync(id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Role not found.");

                if (entity.IsSystemRole)
                    return ApiResponseFactory.BadRequest<bool>("System roles cannot be deleted.");

                entity.IsActive = false;
                await _tenantDb.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Role deleted successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting RBAC tenant role {Id}", id);
                return ApiResponseFactory.InternalError<bool>($"Error deleting role: {ex.Message}");
            }
        }

        // ───────────────────────────────────────────────
        // Role Permissions (with ceiling validation)
        // ───────────────────────────────────────────────

        public async Task<ApiResponse<RbacTenantRolePermMatrixDto>> GetRolePermissionMatrixAsync(int roleId, int tenantId)
        {
            try
            {
                var role = await _tenantDb.RbacTenantRoles.FindAsync(roleId);
                if (role == null)
                    return ApiResponseFactory.NotFound<RbacTenantRolePermMatrixDto>("Role not found.");

                // Get the tenant ceiling from Master DB
                var ceilingPermissionKeys = await GetTenantCeilingKeysAsync(tenantId);

                // Get current role permissions from Tenant DB
                var rolePerms = await _tenantDb.RbacTenantRolePermissions
                    .Where(x => x.RoleId == roleId)
                    .ToDictionaryAsync(x => x.PermissionKey, x => x.IsGranted);

                // Build the full matrix from Master DB permission registry
                var allModules = await _mainDb.Modules
                    .Where(m => m.IsActive)
                    .OrderBy(m => m.SortOrder)
                    .ToListAsync();

                var allScreens = await _mainDb.Screens
                    .Where(s => s.IsActive)
                    .OrderBy(s => s.SortOrder)
                    .ToListAsync();

                var allPermissions = await _mainDb.Permissions
                    .Where(p => p.IsActive)
                    .OrderBy(p => p.SortOrder)
                    .ToListAsync();

                var modules = allModules.Select(m => new RbacPermMatrixModuleDto
                {
                    ModuleId = m.ModuleId,
                    ModuleCode = m.Code,
                    ModuleName = m.ModuleName,
                    Screens = allScreens
                        .Where(s => s.ModuleId == m.ModuleId)
                        .Select(s => new RbacPermMatrixScreenDto
                        {
                            ScreenId = s.Id,
                            ScreenCode = s.Code,
                            ScreenName = s.Name,
                            Permissions = allPermissions
                                .Where(p => p.ScreenId == s.Id)
                                .Select(p => new RbacPermMatrixItemDto
                                {
                                    PermissionId = p.Id,
                                    PermissionKey = p.PermissionKey,
                                    PermissionName = p.Name,
                                    Category = p.Category,
                                    IsGranted = rolePerms.ContainsKey(p.PermissionKey) && rolePerms[p.PermissionKey],
                                    IsInCeiling = ceilingPermissionKeys.Contains(p.PermissionKey)
                                }).ToList()
                        }).ToList()
                }).ToList();

                return ApiResponseFactory.Success(new RbacTenantRolePermMatrixDto
                {
                    RoleId = roleId,
                    RoleName = role.Name,
                    Modules = modules
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching permission matrix for role {RoleId}", roleId);
                return ApiResponseFactory.InternalError<RbacTenantRolePermMatrixDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> UpdateRolePermissionsAsync(int roleId, List<RbacRolePermissionItem> permissions, int tenantId)
        {
            try
            {
                var role = await _tenantDb.RbacTenantRoles.FindAsync(roleId);
                if (role == null)
                    return ApiResponseFactory.NotFound<bool>("Role not found.");

                // Validate against tenant ceiling from Master DB
                var ceilingKeys = await GetTenantCeilingKeysAsync(tenantId);

                var grantedKeys = permissions
                    .Where(p => p.IsGranted)
                    .Select(p => p.PermissionKey)
                    .ToList();

                var outOfCeiling = grantedKeys
                    .Where(k => !ceilingKeys.Contains(k))
                    .ToList();

                if (outOfCeiling.Any())
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        $"The following permissions are not within the tenant ceiling and cannot be granted: {string.Join(", ", outOfCeiling)}");
                }

                // Remove existing permissions for this role
                var existing = await _tenantDb.RbacTenantRolePermissions
                    .Where(x => x.RoleId == roleId)
                    .ToListAsync();

                _tenantDb.RbacTenantRolePermissions.RemoveRange(existing);

                // Add new permissions
                var newPerms = permissions.Select(p => new RbacTenantRolePermission
                {
                    RoleId = roleId,
                    PermissionKey = p.PermissionKey,
                    IsGranted = p.IsGranted
                }).ToList();

                await _tenantDb.RbacTenantRolePermissions.AddRangeAsync(newPerms);
                await _tenantDb.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Role permissions updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating permissions for role {RoleId}", roleId);
                return ApiResponseFactory.InternalError<bool>($"Error updating permissions: {ex.Message}");
            }
        }

        // ───────────────────────────────────────────────
        // User-Role Assignment
        // ───────────────────────────────────────────────

        public async Task<ApiResponse<List<RbacTenantUserRoleDto>>> GetUserRolesAsync(int userId)
        {
            try
            {
                var userRoles = await _tenantDb.RbacTenantUserRoles
                    .Include(x => x.Role)
                    .Where(x => x.UserId == userId)
                    .Select(x => new RbacTenantUserRoleDto
                    {
                        Id = x.Id,
                        UserId = x.UserId,
                        RoleId = x.RoleId,
                        RoleName = x.Role.Name,
                        RoleCode = x.Role.Code,
                        AssignedAt = x.AssignedAt,
                        AssignedByUserId = x.AssignedByUserId
                    })
                    .ToListAsync();

                return ApiResponseFactory.Success(userRoles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user roles for user {UserId}", userId);
                return ApiResponseFactory.InternalError<List<RbacTenantUserRoleDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<List<UserRoleAssignmentDto>>> GetUserRoleAssignmentsAsync(int userId)
        {
            try
            {
                var allRoles = await _tenantDb.RbacTenantRoles
                    .Where(r => r.IsActive)
                    .OrderBy(r => r.Name)
                    .ToListAsync();

                var assignedRoleIds = await _tenantDb.RbacTenantUserRoles
                    .Where(x => x.UserId == userId)
                    .Select(x => x.RoleId)
                    .ToListAsync();

                var assignedSet = new HashSet<int>(assignedRoleIds);

                var result = allRoles.Select(r => new UserRoleAssignmentDto
                {
                    RoleId = r.Id,
                    RoleName = r.Name,
                    RoleCode = r.Code,
                    IsAssigned = assignedSet.Contains(r.Id)
                }).ToList();

                return ApiResponseFactory.Success(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user role assignments for user {UserId}", userId);
                return ApiResponseFactory.InternalError<List<UserRoleAssignmentDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> AssignUserRolesAsync(int userId, List<int> roleIds, int assignedBy)
        {
            try
            {
                // Verify all role IDs exist and are active
                var validRoleIds = await _tenantDb.RbacTenantRoles
                    .Where(x => roleIds.Contains(x.Id) && x.IsActive)
                    .Select(x => x.Id)
                    .ToListAsync();

                var invalidIds = roleIds.Except(validRoleIds).ToList();
                if (invalidIds.Any())
                    return ApiResponseFactory.BadRequest<bool>($"Invalid or inactive role IDs: {string.Join(", ", invalidIds)}");

                // Remove existing assignments
                var existing = await _tenantDb.RbacTenantUserRoles
                    .Where(x => x.UserId == userId)
                    .ToListAsync();

                _tenantDb.RbacTenantUserRoles.RemoveRange(existing);

                // Add new assignments
                var newAssignments = roleIds.Select(roleId => new RbacTenantUserRole
                {
                    UserId = userId,
                    RoleId = roleId,
                    AssignedAt = DateTime.UtcNow,
                    AssignedByUserId = assignedBy
                }).ToList();

                await _tenantDb.RbacTenantUserRoles.AddRangeAsync(newAssignments);
                await _tenantDb.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "User roles assigned successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning roles to user {UserId}", userId);
                return ApiResponseFactory.InternalError<bool>($"Error assigning roles: {ex.Message}");
            }
        }

        // ───────────────────────────────────────────────
        // User Permission Overrides
        // ───────────────────────────────────────────────

        public async Task<ApiResponse<List<RbacUserPermOverrideDto>>> GetUserPermOverridesAsync(int userId)
        {
            try
            {
                var overrides = await _tenantDb.RbacTenantUserPermOverrides
                    .Where(x => x.UserId == userId)
                    .Select(x => new RbacUserPermOverrideDto
                    {
                        Id = x.Id,
                        UserId = x.UserId,
                        PermissionKey = x.PermissionKey,
                        IsGranted = x.IsGranted,
                        Reason = x.Reason,
                        GrantedByUserId = x.GrantedByUserId,
                        ExpiresAt = x.ExpiresAt,
                        CreatedAt = x.CreatedAt
                    })
                    .ToListAsync();

                return ApiResponseFactory.Success(overrides);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching permission overrides for user {UserId}", userId);
                return ApiResponseFactory.InternalError<List<RbacUserPermOverrideDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<int>> CreateUserPermOverrideAsync(CreateRbacUserPermOverrideDto dto, int tenantId)
        {
            try
            {
                // Validate permission key exists in Master DB
                var permExists = await _mainDb.Permissions
                    .AnyAsync(p => p.PermissionKey == dto.PermissionKey && p.IsActive);

                if (!permExists)
                    return ApiResponseFactory.BadRequest<int>($"Permission key '{dto.PermissionKey}' does not exist.");

                // If granting, validate it's within the tenant ceiling
                if (dto.IsGranted)
                {
                    var ceilingKeys = await GetTenantCeilingKeysAsync(tenantId);
                    if (!ceilingKeys.Contains(dto.PermissionKey))
                        return ApiResponseFactory.BadRequest<int>($"Permission '{dto.PermissionKey}' is not within the tenant ceiling.");
                }

                var entity = new RbacTenantUserPermOverride
                {
                    UserId = dto.UserId,
                    PermissionKey = dto.PermissionKey,
                    IsGranted = dto.IsGranted,
                    Reason = dto.Reason,
                    ExpiresAt = dto.ExpiresAt,
                    CreatedAt = DateTime.UtcNow
                };

                _tenantDb.RbacTenantUserPermOverrides.Add(entity);
                await _tenantDb.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.Id, "User permission override created successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating permission override for user {UserId}", dto.UserId);
                return ApiResponseFactory.InternalError<int>($"Error creating override: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteUserPermOverrideAsync(int id)
        {
            try
            {
                var entity = await _tenantDb.RbacTenantUserPermOverrides.FindAsync(id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Override not found.");

                _tenantDb.RbacTenantUserPermOverrides.Remove(entity);
                await _tenantDb.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Override deleted successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting permission override {Id}", id);
                return ApiResponseFactory.InternalError<bool>($"Error deleting override: {ex.Message}");
            }
        }

        // ───────────────────────────────────────────────
        // Admin Initialization
        // ───────────────────────────────────────────────

        /// <summary>
        /// Idempotently seeds the standard operational roles (see DefaultTenantRoles)
        /// into the current tenant's RbacTenantRoles. Roles are created empty and
        /// tenant-editable; any role whose Code already exists is skipped. Returns the
        /// number of roles actually created. Safe to re-run — used both during
        /// onboarding (via InitializeAdminRoleAsync) and to backfill existing tenants.
        /// </summary>
        public async Task<ApiResponse<int>> SeedDefaultRolesAsync(int tenantId, int? createdByUserId)
        {
            try
            {
                var existingCodes = await _tenantDb.RbacTenantRoles
                    .Select(r => r.Code)
                    .ToListAsync();
                var existing = new HashSet<string>(
                    existingCodes.Where(c => !string.IsNullOrEmpty(c)),
                    StringComparer.OrdinalIgnoreCase);

                var toAdd = DefaultTenantRoles.All
                    .Where(r => !existing.Contains(r.Code))
                    .Select(r => new RbacTenantRole
                    {
                        Name = r.Name,
                        Code = r.Code,
                        Description = r.Description,
                        IsSystemRole = false,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        CreatedByUserId = createdByUserId
                    })
                    .ToList();

                if (toAdd.Count == 0)
                    return ApiResponseFactory.Success(0, "All default roles already present.");

                await _tenantDb.RbacTenantRoles.AddRangeAsync(toAdd);

                _tenantDb.RbacTenantAuditLogEntries.Add(new RbacTenantAuditLogEntry
                {
                    Action = "SeedDefaultRoles",
                    EntityType = "RbacTenantRole",
                    EntityId = string.Empty,
                    NewValue = $"Seeded {toAdd.Count} default role(s): {string.Join(", ", toAdd.Select(r => r.Code))}",
                    CreatedAt = DateTime.UtcNow
                });

                await _tenantDb.SaveChangesAsync();

                _logger.LogInformation(
                    "Seeded {Count} default roles for tenant {TenantId}: {Codes}",
                    toAdd.Count, tenantId, string.Join(", ", toAdd.Select(r => r.Code)));

                return ApiResponseFactory.Success(toAdd.Count, $"Seeded {toAdd.Count} default role(s).");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding default roles for tenant {TenantId}", tenantId);
                return ApiResponseFactory.InternalError<int>($"Error seeding default roles: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> InitializeAdminRoleAsync(int tenantId, int? adminUserId)
        {
            try
            {
                // 1. Get or create the "administrator" system role
                var adminRole = await _tenantDb.RbacTenantRoles
                    .FirstOrDefaultAsync(r => r.Code == "administrator");

                if (adminRole == null)
                {
                    adminRole = new RbacTenantRole
                    {
                        Name = "Administrator",
                        Code = "administrator",
                        Description = "System administrator role with full access. Cannot be deleted.",
                        IsSystemRole = true,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };
                    _tenantDb.RbacTenantRoles.Add(adminRole);
                    await _tenantDb.SaveChangesAsync();
                    _logger.LogInformation("Created Administrator role for tenant {TenantId}", tenantId);
                }

                // 2. Get tenant ceiling permission keys from Master DB
                var ceilingKeys = await GetTenantCeilingKeysAsync(tenantId);

                if (ceilingKeys.Count == 0)
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        "No permissions are enabled in the tenant ceiling. " +
                        "Please enable permissions for this tenant first using the Permission Ceiling page.");
                }

                // 3. Replace the admin role's permissions with all ceiling permissions
                var existingPerms = await _tenantDb.RbacTenantRolePermissions
                    .Where(x => x.RoleId == adminRole.Id)
                    .ToListAsync();
                _tenantDb.RbacTenantRolePermissions.RemoveRange(existingPerms);

                var newPerms = ceilingKeys.Select(key => new RbacTenantRolePermission
                {
                    RoleId = adminRole.Id,
                    PermissionKey = key,
                    IsGranted = true
                }).ToList();
                await _tenantDb.RbacTenantRolePermissions.AddRangeAsync(newPerms);

                _logger.LogInformation(
                    "Synced {Count} ceiling permissions to Administrator role for tenant {TenantId}",
                    newPerms.Count, tenantId);

                // 4. Optionally assign the admin user to the role
                if (adminUserId.HasValue && adminUserId.Value > 0)
                {
                    var alreadyAssigned = await _tenantDb.RbacTenantUserRoles
                        .AnyAsync(x => x.UserId == adminUserId.Value && x.RoleId == adminRole.Id);

                    if (!alreadyAssigned)
                    {
                        _tenantDb.RbacTenantUserRoles.Add(new RbacTenantUserRole
                        {
                            UserId = adminUserId.Value,
                            RoleId = adminRole.Id,
                            AssignedAt = DateTime.UtcNow
                        });
                        _logger.LogInformation(
                            "Assigned user {UserId} to Administrator role for tenant {TenantId}",
                            adminUserId.Value, tenantId);
                    }
                }

                await _tenantDb.SaveChangesAsync();

                // Seed the standard operational roles (PACKER, Cashier, ...) so every
                // onboarded tenant has them. Idempotent and self-contained (own save +
                // try/catch), so a seeding hiccup never fails admin initialization.
                await SeedDefaultRolesAsync(tenantId, adminUserId);

                // 5. Audit log
                _tenantDb.RbacTenantAuditLogEntries.Add(new RbacTenantAuditLogEntry
                {
                    Action = "InitializeAdmin",
                    EntityType = "RbacTenantRole",
                    EntityId = adminRole.Id.ToString(),
                    NewValue = $"Synced {newPerms.Count} ceiling permissions. AdminUserId={adminUserId}",
                    CreatedAt = DateTime.UtcNow
                });
                await _tenantDb.SaveChangesAsync();

                return ApiResponseFactory.Success(true,
                    $"Administrator role initialized with {newPerms.Count} permissions." +
                    (adminUserId.HasValue ? $" User {adminUserId.Value} assigned." : ""));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initializing admin role for tenant {TenantId}", tenantId);
                return ApiResponseFactory.InternalError<bool>($"Error initializing admin: {ex.Message}");
            }
        }

        // ───────────────────────────────────────────────
        // Private Helpers
        // ───────────────────────────────────────────────

        /// <summary>
        /// Gets the set of permission keys allowed for the tenant (the ceiling) from Master DB.
        /// </summary>
        private async Task<HashSet<string>> GetTenantCeilingKeysAsync(int tenantId)
        {
            var allowedPermissionIds = await _mainDb.TenantAllowedPermissions
                .Where(x => x.TenantId == tenantId && x.IsAllowed)
                .Select(x => x.PermissionId)
                .ToListAsync();

            var keys = await _mainDb.Permissions
                .Where(p => allowedPermissionIds.Contains(p.Id) && p.IsActive)
                .Select(p => p.PermissionKey)
                .ToListAsync();

            return new HashSet<string>(keys);
        }
    }
}
