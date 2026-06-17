// =============================================================================
// LEGACY FILE - kept for reference. Disabled via #if false; active replacement
// is IWebUserManagementService in the same folder.
// =============================================================================
#if false
using BackOffice.Application.DTOs.Tenant.User;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IUserManagementService
    {
        Task<ApiResponse<UserDetailDto>> CreateUserAsync(CreateUserDto dto, int customerId);
        Task<ApiResponse<UserDetailDto>> UpdateUserAsync(UpdateUserDto dto);
        Task<ApiResponse<bool>> DeleteUserAsync(Guid tenantUserId);
        Task<ApiResponse<UserDetailDto>> GetUserByIdAsync(Guid tenantUserId);
    }
}
#endif
