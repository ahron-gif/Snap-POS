using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Manufacturer;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IManufacturerService
    {
        /// <summary>
        /// Get all manufacturers for grid display
        /// </summary>
        Task<ApiResponse<List<ManufacturerGridDto>>> GetAllManufacturersAsync();

        /// <summary>
        /// Get all manufacturers with pagination, filtering, and sorting support
        /// </summary>
        ApiResponse<PaginationResponseDTO<ManufacturerGridDto>> GetAllManufacturersGridAsync(PaginationGridDto paginationGridDto);

        /// <summary>
        /// Get manufacturer by ID for view/edit
        /// </summary>
        Task<ApiResponse<ManufacturerDetailDto>> GetManufacturerByIdAsync(Guid manufacturerId);

        /// <summary>
        /// Create a new manufacturer
        /// </summary>
        Task<ApiResponse<Guid>> CreateManufacturerAsync(CreateManufacturerDto dto, Guid modifierId);

        /// <summary>
        /// Update an existing manufacturer
        /// </summary>
        Task<ApiResponse<bool>> UpdateManufacturerAsync(UpdateManufacturerDto dto, Guid modifierId);

        /// <summary>
        /// Delete a manufacturer (soft delete - set status to 2)
        /// </summary>
        Task<ApiResponse<bool>> DeleteManufacturerAsync(Guid manufacturerId, Guid modifierId);

        /// <summary>
        /// Check if manufacturer can be deleted (no items attached)
        /// </summary>
        Task<ApiResponse<bool>> CanDeleteManufacturerAsync(Guid manufacturerId);

        /// <summary>
        /// Check if manufacturer name already exists
        /// </summary>
        Task<ApiResponse<bool>> ManufacturerNameExistsAsync(string name, Guid? excludeManufacturerId = null);
    }
}
