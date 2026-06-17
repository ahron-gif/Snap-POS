using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Discount;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IDiscountListService
    {
        /// <summary>
        /// Gets all discounts with pagination, filtering, and sorting support
        /// </summary>
        ApiResponse<PaginationResponseDTO<DiscountGridDto>> GetAllDiscountsGridAsync(PaginationGridDto paginationGridDto);

        /// <summary>
        /// Get discount by ID for view/edit form (includes related items, departments, brands, stores, tenders)
        /// </summary>
        Task<ApiResponse<DiscountDetailDto>> GetDiscountByIdAsync(Guid discountId);

        /// <summary>
        /// Create a new discount with related selections
        /// </summary>
        Task<ApiResponse<Guid>> CreateDiscountAsync(CreateDiscountDto dto, Guid modifierId);

        /// <summary>
        /// Update an existing discount with related selections
        /// </summary>
        Task<ApiResponse<bool>> UpdateDiscountAsync(UpdateDiscountDto dto, Guid modifierId);

        /// <summary>
        /// Delete a discount and its related data
        /// </summary>
        Task<ApiResponse<bool>> DeleteDiscountAsync(Guid discountId, Guid modifierId);

        /// <summary>
        /// Check if a discount can be deleted (exists, not already deleted, etc.)
        /// </summary>
        Task<ApiResponse<bool>> CanDeleteDiscountAsync(Guid discountId);
    }
}
