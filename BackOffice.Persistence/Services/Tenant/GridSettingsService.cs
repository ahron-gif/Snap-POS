using BackOffice.Application.DTOs.Tenant.GridSettings;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// Service for managing user-specific grid column settings
    /// </summary>
    public class GridSettingsService : IGridSettingsService
    {
        private readonly TenantDBContext _context;

        public GridSettingsService(TenantDBContext context)
        {
            _context = context;
        }

        /// <inheritdoc/>
        public async Task<ApiResult<GridSettingsResponseDto?>> GetGridSettingsAsync(Guid userId, string gridId)
        {
            try
            {
                var settings = await _context.UserGridSettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.GridId == gridId);

                if (settings == null)
                {
                    return new ApiResult<GridSettingsResponseDto?>
                    {
                        IsSuccess = true,
                        Message = "No settings found for this grid.",
                        Response = null
                    };
                }

                var columns = JsonSerializer.Deserialize<System.Collections.Generic.List<ColumnSettingDto>>(
                    settings.SettingsJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                );

                return new ApiResult<GridSettingsResponseDto?>
                {
                    IsSuccess = true,
                    Message = "Settings retrieved successfully.",
                    Response = new GridSettingsResponseDto
                    {
                        GridId = settings.GridId,
                        Columns = columns ?? new System.Collections.Generic.List<ColumnSettingDto>(),
                        LastModified = settings.DateModified
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<GridSettingsResponseDto?>
                {
                    IsSuccess = false,
                    Message = $"Error retrieving grid settings: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<bool>> SaveGridSettingsAsync(Guid userId, SaveGridSettingsDto settingsDto)
        {
            try
            {
                var settingsJson = JsonSerializer.Serialize(settingsDto.Columns, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });

                var existingSettings = await _context.UserGridSettings
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.GridId == settingsDto.GridId);

                if (existingSettings != null)
                {
                    // Update existing settings
                    existingSettings.SettingsJson = settingsJson;
                    existingSettings.DateModified = DateTime.UtcNow;
                    _context.UserGridSettings.Update(existingSettings);
                }
                else
                {
                    // Create new settings
                    var newSettings = new UserGridSettings
                    {
                        UserId = userId,
                        GridId = settingsDto.GridId,
                        SettingsJson = settingsJson,
                        DateCreated = DateTime.UtcNow,
                        DateModified = DateTime.UtcNow
                    };
                    await _context.UserGridSettings.AddAsync(newSettings);
                }

                await _context.SaveChangesAsync();

                return new ApiResult<bool>
                {
                    IsSuccess = true,
                    Message = "Grid settings saved successfully.",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = $"Error saving grid settings: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<bool>> DeleteGridSettingsAsync(Guid userId, string gridId)
        {
            try
            {
                var settings = await _context.UserGridSettings
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.GridId == gridId);

                if (settings == null)
                {
                    return new ApiResult<bool>
                    {
                        IsSuccess = true,
                        Message = "No settings found to delete.",
                        Response = true
                    };
                }

                _context.UserGridSettings.Remove(settings);
                await _context.SaveChangesAsync();

                return new ApiResult<bool>
                {
                    IsSuccess = true,
                    Message = "Grid settings deleted successfully.",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = $"Error deleting grid settings: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<bool>> DeleteAllGridSettingsAsync(Guid userId)
        {
            try
            {
                var settings = await _context.UserGridSettings
                    .Where(x => x.UserId == userId)
                    .ToListAsync();

                if (settings.Count == 0)
                {
                    return new ApiResult<bool>
                    {
                        IsSuccess = true,
                        Message = "No settings found to delete.",
                        Response = true
                    };
                }

                _context.UserGridSettings.RemoveRange(settings);
                await _context.SaveChangesAsync();

                return new ApiResult<bool>
                {
                    IsSuccess = true,
                    Message = $"Deleted {settings.Count} grid settings.",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = $"Error deleting grid settings: {ex.Message}",
                    Response = false
                };
            }
        }
    }
}
