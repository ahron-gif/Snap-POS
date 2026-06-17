using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ItemGroup;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IItemGroupService
    {
        /// <summary>
        /// Get all item groups for tree grid display
        /// </summary>
        Task<ApiResponse<List<ItemGroupGridDto>>> GetAllItemGroupsAsync();

        /// <summary>
        /// Get all item groups with pagination, filtering, and sorting support
        /// </summary>
        ApiResponse<PaginationResponseDTO<ItemGroupGridDto>> GetAllItemGroupsGridAsync(PaginationGridDto paginationGridDto);

        /// <summary>
        /// Get item group by ID for view/edit
        /// </summary>
        Task<ApiResponse<ItemGroupDetailDto>> GetItemGroupByIdAsync(Guid itemGroupId);

        /// <summary>
        /// Create a new item group
        /// </summary>
        Task<ApiResponse<Guid>> CreateItemGroupAsync(CreateItemGroupDto dto, Guid modifierId);

        /// <summary>
        /// Update an existing item group
        /// </summary>
        Task<ApiResponse<bool>> UpdateItemGroupAsync(UpdateItemGroupDto dto, Guid modifierId);

        /// <summary>
        /// Delete an item group
        /// </summary>
        Task<ApiResponse<bool>> DeleteItemGroupAsync(Guid itemGroupId, Guid modifierId);

        /// <summary>
        /// Check if item group can be deleted (no items attached)
        /// </summary>
        Task<ApiResponse<bool>> CanDeleteItemGroupAsync(Guid itemGroupId);

        /// <summary>
        /// Check if item group name already exists
        /// </summary>
        Task<ApiResponse<bool>> ItemGroupNameExistsAsync(string name, Guid? excludeItemGroupId = null);
    }
}
