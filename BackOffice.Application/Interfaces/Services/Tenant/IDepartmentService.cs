using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Department;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IDepartmentService
    {
        /// <summary>
        /// Get all departments for tree grid display
        /// </summary>
        Task<ApiResponse<List<DepartmentGridDto>>> GetAllDepartmentsAsync();

        /// <summary>
        /// Get all departments with pagination, filtering, and sorting support
        /// </summary>
        ApiResponse<PaginationResponseDTO<DepartmentGridDto>> GetAllDepartmentsGridAsync(PaginationGridDto paginationGridDto);

        /// <summary>
        /// Get department by ID for view/edit
        /// </summary>
        Task<ApiResponse<DepartmentDetailDto>> GetDepartmentByIdAsync(Guid departmentStoreId);

        /// <summary>
        /// Create a new department
        /// </summary>
        Task<ApiResponse<Guid>> CreateDepartmentAsync(CreateDepartmentDto dto, Guid modifierId);

        /// <summary>
        /// Update an existing department
        /// </summary>
        Task<ApiResponse<bool>> UpdateDepartmentAsync(UpdateDepartmentDto dto, Guid modifierId);

        /// <summary>
        /// Delete a department
        /// </summary>
        Task<ApiResponse<bool>> DeleteDepartmentAsync(Guid departmentStoreId, Guid modifierId);

        /// <summary>
        /// Check if department can be deleted (no items attached)
        /// </summary>
        Task<ApiResponse<bool>> CanDeleteDepartmentAsync(Guid departmentStoreId);

        /// <summary>
        /// Check if department name already exists
        /// </summary>
        Task<ApiResponse<bool>> DepartmentNameExistsAsync(string name, Guid? excludeDepartmentId = null);
    }
}
