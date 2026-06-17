using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ItemGroup;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ItemGroupService : IItemGroupService
    {
        private readonly TenantDBContext _dbContext;

        public ItemGroupService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<ItemGroupGridDto>> GetAllItemGroupsGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.ItemGroupViews
                    .Where(x => x.Status != 2) // Exclude deleted
                    .GroupJoin(
                        _dbContext.ItemGroupViews,
                        child => child.ParentID,
                        parent => parent.ItemGroupID,
                        (child, parents) => new { child, parents })
                    .SelectMany(
                        x => x.parents.DefaultIfEmpty(),
                        (x, parent) => new ItemGroupGridDto
                        {
                            ItemGroupID = x.child.ItemGroupID,
                            Name = x.child.ItemGroupName ?? string.Empty,
                            ParentID = x.child.ParentID,
                            ParentName = parent != null ? parent.ItemGroupName : null,
                            Status = x.child.Status,
                            DateCreated = x.child.DateCreated,
                            DateModified = x.child.DateModified
                        })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.ItemGroupViews.Where(x => x.Status != 2).Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "Name", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ItemGroupGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Item groups retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ItemGroupGridDto>>(
                    "Error fetching item groups.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<ItemGroupGridDto>>> GetAllItemGroupsAsync()
        {
            try
            {
                var itemGroups = await _dbContext.ItemGroupViews
                    .Where(x => x.Status != 2) // Exclude deleted
                    .GroupJoin(
                        _dbContext.ItemGroupViews,
                        child => child.ParentID,
                        parent => parent.ItemGroupID,
                        (child, parents) => new { child, parents })
                    .SelectMany(
                        x => x.parents.DefaultIfEmpty(),
                        (x, parent) => new ItemGroupGridDto
                        {
                            ItemGroupID = x.child.ItemGroupID,
                            Name = x.child.ItemGroupName ?? string.Empty,
                            ParentID = x.child.ParentID,
                            ParentName = parent != null ? parent.ItemGroupName : null,
                            Status = x.child.Status,
                            DateCreated = x.child.DateCreated,
                            DateModified = x.child.DateModified
                        })
                    .OrderBy(x => x.Name)
                    .ToListAsync();

                return new ApiResponse<List<ItemGroupGridDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Item groups retrieved successfully",
                    Response = itemGroups
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<ItemGroupGridDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching item groups: {ex.Message}",
                    Response = new List<ItemGroupGridDto>()
                };
            }
        }

        public async Task<ApiResponse<ItemGroupDetailDto>> GetItemGroupByIdAsync(Guid itemGroupId)
        {
            try
            {
                var itemGroup = await _dbContext.ItemGroupViews
                    .Where(x => x.ItemGroupID == itemGroupId)
                    .Select(x => new ItemGroupDetailDto
                    {
                        ItemGroupID = x.ItemGroupID,
                        Name = x.ItemGroupName ?? string.Empty,
                        ParentID = x.ParentID,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        UserCreated = x.UserCreated,
                        DateModified = x.DateModified,
                        UserModified = x.UserModified
                    })
                    .FirstOrDefaultAsync();

                if (itemGroup == null)
                {
                    return new ApiResponse<ItemGroupDetailDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Item group not found",
                        Response = null
                    };
                }

                return new ApiResponse<ItemGroupDetailDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Item group retrieved successfully",
                    Response = itemGroup
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<ItemGroupDetailDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching item group: {ex.Message}",
                    Response = null
                };
            }
        }

        public async Task<ApiResponse<Guid>> CreateItemGroupAsync(CreateItemGroupDto dto, Guid modifierId)
        {
            try
            {
                var newId = Guid.NewGuid();

                await _dbContext.Procedures.SP_ItemGroupInsertAsync(
                    itemGroupID: newId,
                    itemGroupName: dto.Name,
                    parentID: dto.ParentID,
                    status: 1, // Active
                    modifierID: modifierId
                );

                return new ApiResponse<Guid>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Item group created successfully",
                    Response = newId
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<Guid>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error creating item group: {ex.Message}",
                    Response = Guid.Empty
                };
            }
        }

        public async Task<ApiResponse<bool>> UpdateItemGroupAsync(UpdateItemGroupDto dto, Guid modifierId)
        {
            try
            {
                await _dbContext.Procedures.SP_ItemGroupUpdateAsync(
                    itemGroupID: dto.ItemGroupID,
                    itemGroupName: dto.Name,
                    parentID: dto.ParentID,
                    status: 1, // Active
                    dateModified: DateTime.UtcNow,
                    modifierID: modifierId
                );

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Item group updated successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error updating item group: {ex.Message}",
                    Response = false
                };
            }
        }

        public async Task<ApiResponse<bool>> DeleteItemGroupAsync(Guid itemGroupId, Guid modifierId)
        {
            try
            {
                await _dbContext.Procedures.SP_ItemGroupDeleteAsync(
                    itemGroupID: itemGroupId,
                    modifierID: modifierId
                );

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Item group deleted successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error deleting item group: {ex.Message}",
                    Response = false
                };
            }
        }

        public async Task<ApiResponse<bool>> CanDeleteItemGroupAsync(Guid itemGroupId)
        {
            try
            {
                // Check if item group has any child groups
                var hasChildren = await _dbContext.ItemGroupViews
                    .AnyAsync(x => x.ParentID == itemGroupId && x.Status != 2);

                if (hasChildren)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = true,
                        StatusCode = ResponseCode.Success,
                        Message = "Item group has child groups and cannot be deleted",
                        Response = false
                    };
                }

                // Check if item group has any items attached
                var hasItems = await _dbContext.ItemToGroups
                    .AnyAsync(x => x.ItemGroupID == itemGroupId);

                var canDelete = !hasItems;

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = canDelete ? "Item group can be deleted" : "Item group has items and cannot be deleted",
                    Response = canDelete
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error checking if item group can be deleted: {ex.Message}",
                    Response = false
                };
            }
        }

        public async Task<ApiResponse<bool>> ItemGroupNameExistsAsync(string name, Guid? excludeItemGroupId = null)
        {
            try
            {
                var query = _dbContext.ItemGroupViews
                    .Where(x => x.ItemGroupName == name && x.Status != 2);

                if (excludeItemGroupId.HasValue)
                {
                    query = query.Where(x => x.ItemGroupID != excludeItemGroupId.Value);
                }

                var exists = await query.AnyAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = exists ? "Item group name already exists" : "Item group name is available",
                    Response = exists
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error checking item group name: {ex.Message}",
                    Response = false
                };
            }
        }
    }
}
