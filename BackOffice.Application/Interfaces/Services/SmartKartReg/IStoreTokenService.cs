using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.StoreToken;
using BackOffice.Application.DTOs.SmartKartReg.TokenPermission;
using BackOffice.Application.DTOs.SmartKartReg.TokenStoreAccess;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.SmartKartReg
{
    public interface IStoreTokenService
    {
        ApiResponse<PaginationResponseDTO<StoreTokenGridDto>> GetAllTokensGrid(PaginationGridDto paginationGridDto);
        Task<ApiResponse<List<StoreTokenDropdownDto>>> GetTokensDropdownAsync();
        Task<ApiResponse<StoreTokenDetailDto>> GetTokenByIdAsync(int id);
        Task<ApiResponse<int>> CreateTokenAsync(CreateStoreTokenDto dto, string createdBy);
        Task<ApiResponse<bool>> UpdateTokenAsync(UpdateStoreTokenDto dto, string modifiedBy);
        Task<ApiResponse<bool>> DeleteTokenAsync(int id);
        Task<ApiResponse<List<TokenPermissionGridDto>>> GetTokenPermissionsAsync(int tokenId);
        Task<ApiResponse<bool>> BulkUpdateTokenPermissionsAsync(int tokenId, BulkTokenPermissionUpdateDto dto, string modifiedBy);

        // Token Store Access
        Task<ApiResponse<List<TokenStoreAccessGridDto>>> GetTokenStoreAccessAsync(int tokenId);
        Task<ApiResponse<bool>> BulkUpdateTokenStoreAccessAsync(int tokenId, BulkTokenStoreAccessDto dto, string modifiedBy);
        Task<ApiResponse<bool>> RemoveTokenStoreAccessAsync(int id);
        Task<ApiResponse<List<StoreDropdownDto>>> GetStoresDropdownAsync();
        Task<ApiResponse<List<StoreDropdownDto>>> GetStoresByTokenAsync(int tokenId);
    }
}
