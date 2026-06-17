using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Mian.User;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;

namespace BackOffice.Application.Interfaces.Services
{
    public interface IWebAppUserService
    {
        Task<WebAppUser?> AuthenticateAsync(string userName, string password);
        Task<WebAppUser?> GetByIdAsync(int userId);
        ApiResponse<PaginationResponseDTO<AppUserDto>> GetAllAsync(PaginationGridDto paginationGridDto);

        Task<ApiResponse<object>> SendInviteAsync(int userId, string inviteLink);

        Task<ApiResponse<object>> ApproveInviteAsync(int userId);
        Task<bool> ModifyUserEmailAsync(ModifyUserEmailDto dto);

        /// <summary>
        /// Finds or creates a user for Google OAuth login.
        /// </summary>
        Task<WebAppUser?> FindOrCreateGoogleUserAsync(string email, string name);

        /// <summary>
        /// Gets all users for a specific customer (for user selection dropdown)
        /// </summary>
        Task<ApiResponse<List<UserLookupDto>>> GetUsersByCustomerIdAsync(int customerId);

        Task<ApiResponse<List<UserLookupDto>>> GetDistinctUsersAsync();

        Task<ApiResponse<object>> ForgotPasswordAsync(string email);

        Task<ApiResponse<object>> ResetPasswordAsync(string token, string newPassword);
    }
}
