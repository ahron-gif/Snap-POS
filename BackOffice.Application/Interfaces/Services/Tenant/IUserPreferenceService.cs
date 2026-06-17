using BackOffice.Application.DTOs.Tenant.UserPreferences;
using BackOffice.Common;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    /// <summary>
    /// Service interface for managing user-specific preferences
    /// </summary>
    public interface IUserPreferenceService
    {
        /// <summary>
        /// Gets a single preference by key for a user
        /// </summary>
        Task<ApiResult<UserPreferenceResponseDto?>> GetPreferenceAsync(Guid userId, string key);

        /// <summary>
        /// Gets multiple preferences by keys for a user
        /// </summary>
        Task<ApiResult<List<UserPreferenceResponseDto>>> GetPreferencesAsync(Guid userId, string[] keys);

        /// <summary>
        /// Saves (upserts) a preference for a user
        /// </summary>
        Task<ApiResult<bool>> SavePreferenceAsync(Guid userId, SaveUserPreferenceDto dto);

        /// <summary>
        /// Deletes a preference by key for a user
        /// </summary>
        Task<ApiResult<bool>> DeletePreferenceAsync(Guid userId, string key);
    }
}
