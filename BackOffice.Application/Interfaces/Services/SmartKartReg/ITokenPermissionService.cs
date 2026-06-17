using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.TokenPermission;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.SmartKartReg
{
    public interface ITokenPermissionService
    {
        ApiResponse<PaginationResponseDTO<TokenPermissionGridDto>> GetAllTokenPermissionsGrid(PaginationGridDto paginationGridDto);
        Task<ApiResponse<TokenPermissionDetailDto>> GetTokenPermissionByIdAsync(int id);
        Task<ApiResponse<int>> CreateTokenPermissionAsync(CreateTokenPermissionDto dto, string createdBy);
        Task<ApiResponse<bool>> UpdateTokenPermissionAsync(UpdateTokenPermissionDto dto, string modifiedBy);
        Task<ApiResponse<bool>> DeleteTokenPermissionAsync(int id);
    }
}
