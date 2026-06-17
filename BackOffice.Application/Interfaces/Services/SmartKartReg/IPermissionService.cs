using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.Permission;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.SmartKartReg
{
    public interface IPermissionService
    {
        ApiResponse<PaginationResponseDTO<PermissionGridDto>> GetAllPermissionsGrid(PaginationGridDto paginationGridDto);
        Task<ApiResponse<PermissionDetailDto>> GetPermissionByIdAsync(int id);
        Task<ApiResponse<int>> CreatePermissionAsync(CreatePermissionDto dto, string createdBy);
        Task<ApiResponse<bool>> UpdatePermissionAsync(UpdatePermissionDto dto, string modifiedBy);
        Task<ApiResponse<bool>> DeletePermissionAsync(int id);
        Task<ApiResponse<bool>> PermissionKeyExistsAsync(string key, int? excludeId = null);
    }
}
