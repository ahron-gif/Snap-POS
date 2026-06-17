using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.Permission;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using BackOffice.Common;
using BackOffice.Common.Functions;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using SmartKartReg.Infrastructure.DBContext;

namespace BackOffice.Persistence.Services.SmartKartReg
{
    public class PermissionService : IPermissionService
    {
        private readonly RegistrationDbContext _dbContext;

        public PermissionService(RegistrationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<PermissionGridDto>> GetAllPermissionsGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.Permissions
                    .Select(x => new PermissionGridDto
                    {
                        Id = x.Id,
                        PermissionKey = x.PermissionKey,
                        PermissionName = x.PermissionName,
                        Description = x.Description,
                        Category = x.Category,
                        IsActive = x.IsActive,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified
                    })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.Permissions.Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "PermissionName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<PermissionGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Permissions retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<PermissionGridDto>>(
                    "Error fetching permissions.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<PermissionDetailDto>> GetPermissionByIdAsync(int id)
        {
            try
            {
                var permission = await _dbContext.Permissions
                    .Where(x => x.Id == id)
                    .Select(x => new PermissionDetailDto
                    {
                        Id = x.Id,
                        PermissionKey = x.PermissionKey,
                        PermissionName = x.PermissionName,
                        Description = x.Description,
                        Category = x.Category,
                        IsActive = x.IsActive,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified,
                        CreatedBy = x.CreatedBy,
                        ModifiedBy = x.ModifiedBy
                    })
                    .FirstOrDefaultAsync();

                if (permission == null)
                {
                    return ApiResponseFactory.NotFound<PermissionDetailDto>("Permission not found.");
                }

                return ApiResponseFactory.Success(permission, "Permission retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PermissionDetailDto>(
                    $"Error fetching permission: {ex.Message}");
            }
        }

        public async Task<ApiResponse<int>> CreatePermissionAsync(CreatePermissionDto dto, string createdBy)
        {
            try
            {
                // Check for duplicate permission key
                var keyExists = await _dbContext.Permissions
                    .AnyAsync(x => x.PermissionKey == dto.PermissionKey);

                if (keyExists)
                {
                    return ApiResponseFactory.BadRequest<int>($"Permission key '{dto.PermissionKey}' already exists.");
                }

                var entity = new global::SmartKartReg.Infrastructure.Entities.Permission
                {
                    PermissionKey = dto.PermissionKey,
                    PermissionName = dto.PermissionName,
                    Description = dto.Description,
                    Category = dto.Category,
                    IsActive = dto.IsActive,
                    DateCreated = DateTime.UtcNow,
                    CreatedBy = createdBy
                };

                _dbContext.Permissions.Add(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.Id, "Permission created successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<int>(
                    $"Error creating permission: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdatePermissionAsync(UpdatePermissionDto dto, string modifiedBy)
        {
            try
            {
                var entity = await _dbContext.Permissions.FindAsync(dto.Id);
                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Permission not found.");
                }

                // Check for duplicate permission key (excluding current)
                var keyExists = await _dbContext.Permissions
                    .AnyAsync(x => x.PermissionKey == dto.PermissionKey && x.Id != dto.Id);

                if (keyExists)
                {
                    return ApiResponseFactory.BadRequest<bool>($"Permission key '{dto.PermissionKey}' already exists.");
                }

                entity.PermissionKey = dto.PermissionKey;
                entity.PermissionName = dto.PermissionName;
                entity.Description = dto.Description;
                entity.Category = dto.Category;
                entity.IsActive = dto.IsActive;
                entity.DateModified = DateTime.UtcNow;
                entity.ModifiedBy = modifiedBy;

                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Permission updated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error updating permission: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeletePermissionAsync(int id)
        {
            try
            {
                var entity = await _dbContext.Permissions.FindAsync(id);
                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Permission not found.");
                }

                // Check if permission is assigned to any token
                var hasTokenMappings = await _dbContext.TokenPermissions
                    .AnyAsync(x => x.PermissionId == id);

                if (hasTokenMappings)
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        "Cannot delete permission. It is assigned to one or more tokens. Remove the token-permission mappings first.");
                }

                _dbContext.Permissions.Remove(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Permission deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error deleting permission: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> PermissionKeyExistsAsync(string key, int? excludeId = null)
        {
            try
            {
                var query = _dbContext.Permissions.Where(x => x.PermissionKey == key);

                if (excludeId.HasValue)
                {
                    query = query.Where(x => x.Id != excludeId.Value);
                }

                var exists = await query.AnyAsync();

                return ApiResponseFactory.Success(exists,
                    exists ? "Permission key already exists." : "Permission key is available.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error checking permission key: {ex.Message}");
            }
        }
    }
}
