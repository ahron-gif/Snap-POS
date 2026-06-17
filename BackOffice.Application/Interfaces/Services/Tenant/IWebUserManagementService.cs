using BackOffice.Application.DTOs.Tenant.User;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IWebUserManagementService
    {
        Task<ApiResponse<UserDetailDto>> CreateUserAsync(CreateUserDto dto, int customerId, bool callerIsSuperAdmin);
        Task<ApiResponse<UserDetailDto>> UpdateUserAsync(UpdateUserDto dto, bool callerIsSuperAdmin);
        Task<ApiResponse<bool>> DeleteUserAsync(Guid tenantUserId);
        Task<ApiResponse<UserDetailDto>> GetUserByIdAsync(Guid tenantUserId);

        // ── Self-service profile (the /profile page) ─────────────────────────
        // All keyed by the caller's WebAppUser primary key (resolved from the JWT
        // "UserId" claim, never client-supplied) so a user can only ever
        // read/update their own record — and never an ambiguous "first" row.

        /// <summary>Loads the logged-in user's own profile (username read-only).</summary>
        Task<ApiResponse<MyProfileDto>> GetMyProfileAsync(int userId);

        /// <summary>
        /// Updates the caller's email / phone across ALL of their user rows
        /// (WebAppUser, AppUser, WebUser, User). Username and password are never
        /// touched here — password has its own endpoint.
        /// </summary>
        Task<ApiResponse<MyProfileDto>> UpdateMyProfileAsync(int userId, UpdateMyProfileDto dto);

        /// <summary>
        /// Verifies the caller's current password, then sets the new one across
        /// ALL of their user rows.
        /// </summary>
        Task<ApiResponse<bool>> ChangeMyPasswordAsync(int userId, ChangePasswordDto dto);

        /// <summary>
        /// Sets (or clears, when <paramref name="s3Path"/> is null) the caller's
        /// profile image. Stored ONLY on WebAppUser. Returns the new raw path.
        /// </summary>
        Task<ApiResponse<string?>> UpdateProfileImageAsync(int userId, string? s3Path);
    }
}
