using BackOffice.Application.DTOs.Tenant.UserPreferences;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// Service for managing user-specific preferences
    /// </summary>
    public class UserPreferenceService : IUserPreferenceService
    {
        private readonly TenantDBContext _context;

        public UserPreferenceService(TenantDBContext context)
        {
            _context = context;
        }

        /// <inheritdoc/>
        public async Task<ApiResult<UserPreferenceResponseDto?>> GetPreferenceAsync(Guid userId, string key)
        {
            try
            {
                var preference = await _context.UserPreferences
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.PreferenceKey == key);

                if (preference == null)
                {
                    return new ApiResult<UserPreferenceResponseDto?>
                    {
                        IsSuccess = true,
                        Message = "No preference found.",
                        Response = null
                    };
                }

                return new ApiResult<UserPreferenceResponseDto?>
                {
                    IsSuccess = true,
                    Message = "Preference retrieved successfully.",
                    Response = new UserPreferenceResponseDto
                    {
                        PreferenceKey = preference.PreferenceKey,
                        PreferenceValue = preference.PreferenceValue,
                        LastModified = preference.DateModified
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<UserPreferenceResponseDto?>
                {
                    IsSuccess = false,
                    Message = $"Error retrieving preference: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<List<UserPreferenceResponseDto>>> GetPreferencesAsync(Guid userId, string[] keys)
        {
            try
            {
                var preferences = await _context.UserPreferences
                    .AsNoTracking()
                    .Where(x => x.UserId == userId && keys.Contains(x.PreferenceKey))
                    .Select(x => new UserPreferenceResponseDto
                    {
                        PreferenceKey = x.PreferenceKey,
                        PreferenceValue = x.PreferenceValue,
                        LastModified = x.DateModified
                    })
                    .ToListAsync();

                return new ApiResult<List<UserPreferenceResponseDto>>
                {
                    IsSuccess = true,
                    Message = $"Retrieved {preferences.Count} preference(s).",
                    Response = preferences
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<List<UserPreferenceResponseDto>>
                {
                    IsSuccess = false,
                    Message = $"Error retrieving preferences: {ex.Message}",
                    Response = new List<UserPreferenceResponseDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<bool>> SavePreferenceAsync(Guid userId, SaveUserPreferenceDto dto)
        {
            try
            {
                var existing = await _context.UserPreferences
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.PreferenceKey == dto.PreferenceKey);

                if (existing != null)
                {
                    existing.PreferenceValue = dto.PreferenceValue;
                    existing.DateModified = DateTime.UtcNow;
                    _context.UserPreferences.Update(existing);
                }
                else
                {
                    var newPreference = new UserPreference
                    {
                        UserId = userId,
                        PreferenceKey = dto.PreferenceKey,
                        PreferenceValue = dto.PreferenceValue,
                        DateCreated = DateTime.UtcNow,
                        DateModified = DateTime.UtcNow
                    };
                    await _context.UserPreferences.AddAsync(newPreference);
                }

                await _context.SaveChangesAsync();

                return new ApiResult<bool>
                {
                    IsSuccess = true,
                    Message = "Preference saved successfully.",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = $"Error saving preference: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<bool>> DeletePreferenceAsync(Guid userId, string key)
        {
            try
            {
                var preference = await _context.UserPreferences
                    .FirstOrDefaultAsync(x => x.UserId == userId && x.PreferenceKey == key);

                if (preference == null)
                {
                    return new ApiResult<bool>
                    {
                        IsSuccess = true,
                        Message = "No preference found to delete.",
                        Response = true
                    };
                }

                _context.UserPreferences.Remove(preference);
                await _context.SaveChangesAsync();

                return new ApiResult<bool>
                {
                    IsSuccess = true,
                    Message = "Preference deleted successfully.",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = $"Error deleting preference: {ex.Message}",
                    Response = false
                };
            }
        }
    }
}
