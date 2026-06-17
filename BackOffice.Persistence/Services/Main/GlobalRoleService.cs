using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Main.RoleManagement;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Main
{
    public class GlobalRoleService : IGlobalRoleService
    {
        private readonly IUnitOfWorkMain _unitOfWork;
        private readonly MainDBContext _dbContext;
        private readonly IMapper _mapper;
        private readonly ILogger<GlobalRoleService> _logger;

        public GlobalRoleService(
            IUnitOfWorkMain unitOfWork,
            MainDBContext dbContext,
            IMapper mapper,
            ILogger<GlobalRoleService> logger)
        {
            _unitOfWork = unitOfWork;
            _dbContext = dbContext;
            _mapper = mapper;
            _logger = logger;
        }

        public ApiResponse<PaginationResponseDTO<ScreenActionDto>> GetScreenActionsGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                var filters = new List<PaginationGridFilterDto>();
                if (!string.IsNullOrEmpty(paginationGridDto.Filters) &&
                    CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = from sa in _dbContext.ScreenActions
                            join m in _dbContext.Modules on sa.ModuleId equals m.ModuleId
                            where sa.IsActive
                            select new ScreenActionDto
                            {
                                ScreenActionId = sa.ScreenActionId,
                                ModuleId = sa.ModuleId,
                                ModuleName = m.ModuleName,
                                ActionKey = sa.ActionKey,
                                ActionName = sa.ActionName,
                                Description = sa.Description,
                                SortOrder = sa.SortOrder,
                                IsActive = sa.IsActive
                            };

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var totalRecords = _dbContext.ScreenActions.Count(x => x.IsActive);
                var filteredRecords = query.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "ModuleName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                return ApiResponseFactory.Success(new PaginationResponseDTO<ScreenActionDto>
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
                _logger.LogError(ex, "Error fetching screen actions grid");
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ScreenActionDto>>(
                    "Error fetching screen actions.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<ScreenActionGroupDto>>> GetScreenActionsGroupedAsync()
        {
            try
            {
                var screenActions = await (from sa in _dbContext.ScreenActions
                                          join m in _dbContext.Modules on sa.ModuleId equals m.ModuleId
                                          where sa.IsActive
                                          orderby m.ModuleName, sa.SortOrder
                                          select new
                                          {
                                              sa.ScreenActionId,
                                              sa.ModuleId,
                                              m.ModuleName,
                                              m.PageURL,
                                              sa.ActionKey,
                                              sa.ActionName,
                                              sa.Description,
                                              sa.SortOrder,
                                              sa.IsActive
                                          }).ToListAsync();

                var groups = screenActions
                    .GroupBy(x => new { x.ModuleId, x.ModuleName, x.PageURL })
                    .Select(g => new ScreenActionGroupDto
                    {
                        ModuleId = g.Key.ModuleId,
                        ModuleName = g.Key.ModuleName,
                        PageURL = g.Key.PageURL,
                        Actions = g.Select(a => new ScreenActionDto
                        {
                            ScreenActionId = a.ScreenActionId,
                            ModuleId = a.ModuleId,
                            ModuleName = a.ModuleName,
                            ActionKey = a.ActionKey,
                            ActionName = a.ActionName,
                            Description = a.Description,
                            SortOrder = a.SortOrder,
                            IsActive = a.IsActive
                        }).ToList()
                    }).ToList();

                return ApiResponseFactory.Success(groups);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching grouped screen actions");
                return ApiResponseFactory.InternalError<List<ScreenActionGroupDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<List<ScreenActionDto>>> GetScreenActionsByModuleAsync(int moduleId)
        {
            try
            {
                var actions = await (from sa in _dbContext.ScreenActions
                                    join m in _dbContext.Modules on sa.ModuleId equals m.ModuleId
                                    where sa.ModuleId == moduleId && sa.IsActive
                                    orderby sa.SortOrder
                                    select new ScreenActionDto
                                    {
                                        ScreenActionId = sa.ScreenActionId,
                                        ModuleId = sa.ModuleId,
                                        ModuleName = m.ModuleName,
                                        ActionKey = sa.ActionKey,
                                        ActionName = sa.ActionName,
                                        Description = sa.Description,
                                        SortOrder = sa.SortOrder,
                                        IsActive = sa.IsActive
                                    }).ToListAsync();

                return ApiResponseFactory.Success(actions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching screen actions for module {ModuleId}", moduleId);
                return ApiResponseFactory.InternalError<List<ScreenActionDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<int>> CreateScreenActionAsync(CreateScreenActionDto dto)
        {
            try
            {
                var exists = await _dbContext.ScreenActions
                    .AnyAsync(x => x.ModuleId == dto.ModuleId && x.ActionKey == dto.ActionKey);
                if (exists)
                    return ApiResponseFactory.BadRequest<int>($"Action key '{dto.ActionKey}' already exists for this module.");

                var entity = new ScreenAction
                {
                    ModuleId = dto.ModuleId,
                    ActionKey = dto.ActionKey,
                    ActionName = dto.ActionName,
                    Description = dto.Description,
                    SortOrder = dto.SortOrder,
                    IsActive = true,
                    DateCreated = DateTime.UtcNow
                };

                _dbContext.ScreenActions.Add(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.ScreenActionId, "Screen action created successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating screen action");
                return ApiResponseFactory.InternalError<int>($"Error creating screen action: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdateScreenActionAsync(UpdateScreenActionDto dto)
        {
            try
            {
                var entity = await _dbContext.ScreenActions.FindAsync(dto.ScreenActionId);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Screen action not found.");

                var duplicate = await _dbContext.ScreenActions
                    .AnyAsync(x => x.ModuleId == dto.ModuleId && x.ActionKey == dto.ActionKey && x.ScreenActionId != dto.ScreenActionId);
                if (duplicate)
                    return ApiResponseFactory.BadRequest<bool>($"Action key '{dto.ActionKey}' already exists for this module.");

                entity.ModuleId = dto.ModuleId;
                entity.ActionKey = dto.ActionKey;
                entity.ActionName = dto.ActionName;
                entity.Description = dto.Description;
                entity.SortOrder = dto.SortOrder;
                entity.DateModified = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Screen action updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating screen action {Id}", dto.ScreenActionId);
                return ApiResponseFactory.InternalError<bool>($"Error updating screen action: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteScreenActionAsync(int id)
        {
            try
            {
                var entity = await _dbContext.ScreenActions.FindAsync(id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Screen action not found.");

                entity.IsActive = false;
                entity.DateModified = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Screen action deleted successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting screen action {Id}", id);
                return ApiResponseFactory.InternalError<bool>($"Error deleting screen action: {ex.Message}");
            }
        }

        public ApiResponse<PaginationResponseDTO<GlobalRoleGridDto>> GetRolesGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                var filters = new List<PaginationGridFilterDto>();
                if (!string.IsNullOrEmpty(paginationGridDto.Filters) &&
                    CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.GlobalRoles
                    .Where(x => x.IsActive)
                    .Select(x => new GlobalRoleGridDto
                    {
                        GlobalRoleId = x.GlobalRoleId,
                        RoleName = x.RoleName,
                        RoleLevel = x.RoleLevel,
                        Description = x.Description,
                        IsActive = x.IsActive,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified
                    }).AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var totalRecords = _dbContext.GlobalRoles.Count(x => x.IsActive);
                var filteredRecords = query.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "RoleName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                return ApiResponseFactory.Success(new PaginationResponseDTO<GlobalRoleGridDto>
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
                _logger.LogError(ex, "Error fetching global roles grid");
                return ApiResponseFactory.InternalError<PaginationResponseDTO<GlobalRoleGridDto>>(
                    "Error fetching roles.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<GlobalRoleDetailDto>> GetRoleByIdAsync(int id)
        {
            try
            {
                var entity = await _dbContext.GlobalRoles
                    .Where(x => x.GlobalRoleId == id)
                    .Select(x => new GlobalRoleDetailDto
                    {
                        GlobalRoleId = x.GlobalRoleId,
                        RoleName = x.RoleName,
                        RoleLevel = x.RoleLevel,
                        Description = x.Description,
                        IsActive = x.IsActive,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified,
                        CreatedBy = x.CreatedBy
                    }).FirstOrDefaultAsync();

                if (entity == null)
                    return ApiResponseFactory.NotFound<GlobalRoleDetailDto>("Role not found.");

                return ApiResponseFactory.Success(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching role {Id}", id);
                return ApiResponseFactory.InternalError<GlobalRoleDetailDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<int>> CreateRoleAsync(CreateGlobalRoleDto dto, int createdBy)
        {
            try
            {
                var exists = await _dbContext.GlobalRoles
                    .AnyAsync(x => x.RoleName == dto.RoleName && x.RoleLevel == dto.RoleLevel);
                if (exists)
                    return ApiResponseFactory.BadRequest<int>($"Role '{dto.RoleName}' with level '{dto.RoleLevel}' already exists.");

                var entity = new GlobalRole
                {
                    RoleName = dto.RoleName,
                    RoleLevel = dto.RoleLevel,
                    Description = dto.Description,
                    IsActive = true,
                    DateCreated = DateTime.UtcNow,
                    CreatedBy = createdBy
                };

                _dbContext.GlobalRoles.Add(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.GlobalRoleId, "Role created successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating role");
                return ApiResponseFactory.InternalError<int>($"Error creating role: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdateRoleAsync(UpdateGlobalRoleDto dto)
        {
            try
            {
                var entity = await _dbContext.GlobalRoles.FindAsync(dto.GlobalRoleId);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Role not found.");

                var duplicate = await _dbContext.GlobalRoles
                    .AnyAsync(x => x.RoleName == dto.RoleName && x.RoleLevel == dto.RoleLevel && x.GlobalRoleId != dto.GlobalRoleId);
                if (duplicate)
                    return ApiResponseFactory.BadRequest<bool>($"Role '{dto.RoleName}' with level '{dto.RoleLevel}' already exists.");

                entity.RoleName = dto.RoleName;
                entity.RoleLevel = dto.RoleLevel;
                entity.Description = dto.Description;
                entity.IsActive = dto.IsActive;
                entity.DateModified = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Role updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating role {Id}", dto.GlobalRoleId);
                return ApiResponseFactory.InternalError<bool>($"Error updating role: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteRoleAsync(int id)
        {
            try
            {
                var entity = await _dbContext.GlobalRoles.FindAsync(id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Role not found.");

                entity.IsActive = false;
                entity.DateModified = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Role deleted successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting role {Id}", id);
                return ApiResponseFactory.InternalError<bool>($"Error deleting role: {ex.Message}");
            }
        }

        public async Task<ApiResponse<GlobalRolePermissionMatrixDto>> GetRolePermissionsAsync(int roleId)
        {
            try
            {
                var role = await _dbContext.GlobalRoles.FindAsync(roleId);
                if (role == null)
                    return ApiResponseFactory.NotFound<GlobalRolePermissionMatrixDto>("Role not found.");

                var screenActionGroups = await GetScreenActionsGroupedAsync();

                var permissions = await _dbContext.GlobalRoleScreenActions
                    .Where(x => x.GlobalRoleId == roleId)
                    .Select(x => new RolePermissionItemDto
                    {
                        ScreenActionId = x.ScreenActionId,
                        IsAllowed = x.IsAllowed
                    }).ToListAsync();

                return ApiResponseFactory.Success(new GlobalRolePermissionMatrixDto
                {
                    GlobalRoleId = roleId,
                    RoleName = role.RoleName,
                    ScreenActionGroups = screenActionGroups.Response ?? new List<ScreenActionGroupDto>(),
                    Permissions = permissions
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching permissions for role {RoleId}", roleId);
                return ApiResponseFactory.InternalError<GlobalRolePermissionMatrixDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> BulkUpdateRolePermissionsAsync(int roleId, BulkPermissionUpdateDto dto)
        {
            try
            {
                var role = await _dbContext.GlobalRoles.FindAsync(roleId);
                if (role == null)
                    return ApiResponseFactory.NotFound<bool>("Role not found.");

                var existing = await _dbContext.GlobalRoleScreenActions
                    .Where(x => x.GlobalRoleId == roleId)
                    .ToListAsync();

                _dbContext.GlobalRoleScreenActions.RemoveRange(existing);

                var newPermissions = dto.Permissions.Select(p => new GlobalRoleScreenAction
                {
                    GlobalRoleId = roleId,
                    ScreenActionId = p.ScreenActionId,
                    IsAllowed = p.IsAllowed
                }).ToList();

                await _dbContext.GlobalRoleScreenActions.AddRangeAsync(newPermissions);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Permissions updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating permissions for role {RoleId}", roleId);
                return ApiResponseFactory.InternalError<bool>($"Error updating permissions: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<int>>> GetCustomerRoleIdsAsync(int customerId)
        {
            try
            {
                var roleIds = await _dbContext.CustomerGlobalRoles
                    .Where(x => x.CustomerId == customerId)
                    .Select(x => x.GlobalRoleId)
                    .ToListAsync();

                return ApiResponseFactory.Success(roleIds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching customer role IDs for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<List<int>>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> AssignRolesToCustomerAsync(CustomerRoleAssignmentDto dto, int assignedBy)
        {
            try
            {
                var existing = await _dbContext.CustomerGlobalRoles
                    .Where(x => x.CustomerId == dto.CustomerId)
                    .ToListAsync();

                _dbContext.CustomerGlobalRoles.RemoveRange(existing);

                var newAssignments = dto.GlobalRoleIds.Select(roleId => new CustomerGlobalRole
                {
                    CustomerId = dto.CustomerId,
                    GlobalRoleId = roleId,
                    DateAssigned = DateTime.UtcNow,
                    AssignedBy = assignedBy
                }).ToList();

                await _dbContext.CustomerGlobalRoles.AddRangeAsync(newAssignments);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Roles assigned to customer successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning roles to customer {CustomerId}", dto.CustomerId);
                return ApiResponseFactory.InternalError<bool>($"Error assigning roles: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<int>>> GetUserRoleIdsAsync(int userId)
        {
            try
            {
                var roleIds = await _dbContext.AppUserGlobalRoles
                    .Where(x => x.UserId == userId)
                    .Select(x => x.GlobalRoleId)
                    .ToListAsync();

                return ApiResponseFactory.Success(roleIds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user role IDs for user {UserId}", userId);
                return ApiResponseFactory.InternalError<List<int>>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> AssignRolesToUserAsync(AppUserRoleAssignmentDto dto, int assignedBy)
        {
            try
            {
                var existing = await _dbContext.AppUserGlobalRoles
                    .Where(x => x.UserId == dto.UserId)
                    .ToListAsync();

                _dbContext.AppUserGlobalRoles.RemoveRange(existing);

                var newAssignments = dto.GlobalRoleIds.Select(roleId => new AppUserGlobalRole
                {
                    UserId = dto.UserId,
                    GlobalRoleId = roleId,
                    DateAssigned = DateTime.UtcNow,
                    AssignedBy = assignedBy
                }).ToList();

                await _dbContext.AppUserGlobalRoles.AddRangeAsync(newAssignments);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Roles assigned to user successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning roles to user {UserId}", dto.UserId);
                return ApiResponseFactory.InternalError<bool>($"Error assigning roles: {ex.Message}");
            }
        }
    }
}
