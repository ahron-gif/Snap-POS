using BackOffice.Application.DTOs.Tenant.GridSettings;
using BackOffice.Common;
using System;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    /// <summary>
    /// Service interface for managing user-specific grid column settings
    /// </summary>
    public interface IGridSettingsService
    {
        /// <summary>
        /// Gets the grid settings for a specific user and grid
        /// </summary>
        /// <param name="userId">User ID</param>
        /// <param name="gridId">Grid identifier</param>
        /// <returns>Grid settings or null if not found</returns>
        Task<ApiResult<GridSettingsResponseDto?>> GetGridSettingsAsync(Guid userId, string gridId);

        /// <summary>
        /// Saves grid settings for a specific user and grid
        /// </summary>
        /// <param name="userId">User ID</param>
        /// <param name="settings">Grid settings to save</param>
        /// <returns>Success result</returns>
        Task<ApiResult<bool>> SaveGridSettingsAsync(Guid userId, SaveGridSettingsDto settings);

        /// <summary>
        /// Deletes grid settings for a specific user and grid
        /// </summary>
        /// <param name="userId">User ID</param>
        /// <param name="gridId">Grid identifier</param>
        /// <returns>Success result</returns>
        Task<ApiResult<bool>> DeleteGridSettingsAsync(Guid userId, string gridId);

        /// <summary>
        /// Deletes all grid settings for a specific user
        /// </summary>
        /// <param name="userId">User ID</param>
        /// <returns>Success result</returns>
        Task<ApiResult<bool>> DeleteAllGridSettingsAsync(Guid userId);
    }
}
