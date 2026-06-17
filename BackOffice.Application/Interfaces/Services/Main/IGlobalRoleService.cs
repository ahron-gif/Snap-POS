using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Main.RoleManagement;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IGlobalRoleService
    {
        ApiResponse<PaginationResponseDTO<ScreenActionDto>> GetScreenActionsGrid(PaginationGridDto paginationGridDto);
        Task<ApiResponse<List<ScreenActionGroupDto>>> GetScreenActionsGroupedAsync();
        Task<ApiResponse<List<ScreenActionDto>>> GetScreenActionsByModuleAsync(int moduleId);
        Task<ApiResponse<int>> CreateScreenActionAsync(CreateScreenActionDto dto);
        Task<ApiResponse<bool>> UpdateScreenActionAsync(UpdateScreenActionDto dto);
        Task<ApiResponse<bool>> DeleteScreenActionAsync(int id);

        ApiResponse<PaginationResponseDTO<GlobalRoleGridDto>> GetRolesGrid(PaginationGridDto paginationGridDto);
        Task<ApiResponse<GlobalRoleDetailDto>> GetRoleByIdAsync(int id);
        Task<ApiResponse<int>> CreateRoleAsync(CreateGlobalRoleDto dto, int createdBy);
        Task<ApiResponse<bool>> UpdateRoleAsync(UpdateGlobalRoleDto dto);
        Task<ApiResponse<bool>> DeleteRoleAsync(int id);

        Task<ApiResponse<GlobalRolePermissionMatrixDto>> GetRolePermissionsAsync(int roleId);
        Task<ApiResponse<bool>> BulkUpdateRolePermissionsAsync(int roleId, BulkPermissionUpdateDto dto);

        Task<ApiResponse<List<int>>> GetCustomerRoleIdsAsync(int customerId);
        Task<ApiResponse<bool>> AssignRolesToCustomerAsync(CustomerRoleAssignmentDto dto, int assignedBy);

        Task<ApiResponse<List<int>>> GetUserRoleIdsAsync(int userId);
        Task<ApiResponse<bool>> AssignRolesToUserAsync(AppUserRoleAssignmentDto dto, int assignedBy);
    }
}
