using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    public class BillingConfigService : IBillingConfigService
    {
        private readonly MainDBContext _dbContext;
        private readonly ILogger<BillingConfigService> _logger;

        public BillingConfigService(
            MainDBContext dbContext,
            ILogger<BillingConfigService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<ApiResponse<List<BillingConfigDto>>> GetAllConfigsAsync()
        {
            try
            {
                var configs = await _dbContext.BillingConfigs
                    .OrderBy(c => c.ConfigKey)
                    .Select(c => new BillingConfigDto
                    {
                        Id = c.Id,
                        ConfigKey = c.ConfigKey,
                        ConfigValue = c.ConfigValue,
                        Description = c.Description
                    })
                    .ToListAsync();

                return ApiResponseFactory.Success(configs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching billing configs");
                return ApiResponseFactory.InternalError<List<BillingConfigDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> UpdateConfigAsync(UpdateBillingConfigDto dto, int updatedBy)
        {
            try
            {
                var entity = await _dbContext.BillingConfigs
                    .FirstOrDefaultAsync(c => c.ConfigKey == dto.ConfigKey);

                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>($"Config with key '{dto.ConfigKey}' not found.");

                entity.ConfigValue = dto.ConfigValue;
                entity.UpdatedAt = DateTime.UtcNow;
                entity.UpdatedBy = updatedBy;

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Config updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating billing config {ConfigKey}", dto.ConfigKey);
                return ApiResponseFactory.InternalError<bool>($"Error updating config: {ex.Message}");
            }
        }

        public async Task<ApiResponse<string?>> GetConfigValueAsync(string key)
        {
            try
            {
                var value = await _dbContext.BillingConfigs
                    .Where(c => c.ConfigKey == key)
                    .Select(c => c.ConfigValue)
                    .FirstOrDefaultAsync();

                if (value == null)
                    return ApiResponseFactory.NotFound<string?>($"Config with key '{key}' not found.");

                return ApiResponseFactory.Success<string?>(value);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching billing config value for {Key}", key);
                return ApiResponseFactory.InternalError<string?>(ex.Message);
            }
        }
    }
}
