using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    public class ApiDefinitionService : IApiDefinitionService
    {
        private readonly MainDBContext _dbContext;
        private readonly ILogger<ApiDefinitionService> _logger;

        public ApiDefinitionService(
            MainDBContext dbContext,
            ILogger<ApiDefinitionService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<ApiResponse<List<ApiDefinitionDto>>> GetAllApiDefinitionsAsync()
        {
            try
            {
                var definitions = await _dbContext.ApiDefinitions
                    .Where(d => d.IsActive)
                    .OrderBy(d => d.SortOrder)
                    .Select(d => new ApiDefinitionDto
                    {
                        Id = d.Id,
                        Name = d.Name,
                        Code = d.Code,
                        Description = d.Description,
                        DefaultRatePerCall = d.DefaultRatePerCall,
                        DefaultFreeTier = d.DefaultFreeTier,
                        IsActive = d.IsActive,
                        SortOrder = d.SortOrder
                    })
                    .ToListAsync();

                return ApiResponseFactory.Success(definitions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching API definitions");
                return ApiResponseFactory.InternalError<List<ApiDefinitionDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<ApiDefinitionDto>> CreateApiDefinitionAsync(CreateApiDefinitionDto dto)
        {
            try
            {
                var exists = await _dbContext.ApiDefinitions
                    .AnyAsync(d => d.Code == dto.Code);
                if (exists)
                    return ApiResponseFactory.BadRequest<ApiDefinitionDto>($"API definition with code '{dto.Code}' already exists.");

                var entity = new ApiDefinition
                {
                    Name = dto.Name,
                    Code = dto.Code,
                    Description = dto.Description,
                    DefaultRatePerCall = dto.DefaultRatePerCall,
                    DefaultFreeTier = dto.DefaultFreeTier,
                    IsActive = true,
                    SortOrder = 0,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.ApiDefinitions.Add(entity);
                await _dbContext.SaveChangesAsync();

                var result = new ApiDefinitionDto
                {
                    Id = entity.Id,
                    Name = entity.Name,
                    Code = entity.Code,
                    Description = entity.Description,
                    DefaultRatePerCall = entity.DefaultRatePerCall,
                    DefaultFreeTier = entity.DefaultFreeTier,
                    IsActive = entity.IsActive,
                    SortOrder = entity.SortOrder
                };

                return ApiResponseFactory.Success(result, "API definition created successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating API definition");
                return ApiResponseFactory.InternalError<ApiDefinitionDto>($"Error creating API definition: {ex.Message}");
            }
        }

        public async Task<ApiResponse<ApiDefinitionDto>> UpdateApiDefinitionAsync(int id, UpdateApiDefinitionDto dto)
        {
            try
            {
                var entity = await _dbContext.ApiDefinitions.FindAsync(id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<ApiDefinitionDto>("API definition not found.");

                var duplicate = await _dbContext.ApiDefinitions
                    .AnyAsync(d => d.Code == dto.Code && d.Id != id);
                if (duplicate)
                    return ApiResponseFactory.BadRequest<ApiDefinitionDto>($"API definition with code '{dto.Code}' already exists.");

                entity.Name = dto.Name;
                entity.Code = dto.Code;
                entity.Description = dto.Description;
                entity.DefaultRatePerCall = dto.DefaultRatePerCall;
                entity.DefaultFreeTier = dto.DefaultFreeTier;
                entity.IsActive = dto.IsActive;
                entity.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();

                var result = new ApiDefinitionDto
                {
                    Id = entity.Id,
                    Name = entity.Name,
                    Code = entity.Code,
                    Description = entity.Description,
                    DefaultRatePerCall = entity.DefaultRatePerCall,
                    DefaultFreeTier = entity.DefaultFreeTier,
                    IsActive = entity.IsActive,
                    SortOrder = entity.SortOrder
                };

                return ApiResponseFactory.Success(result, "API definition updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating API definition {Id}", id);
                return ApiResponseFactory.InternalError<ApiDefinitionDto>($"Error updating API definition: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteApiDefinitionAsync(int id)
        {
            try
            {
                var entity = await _dbContext.ApiDefinitions.FindAsync(id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("API definition not found.");

                entity.IsActive = false;
                entity.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "API definition deleted successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting API definition {Id}", id);
                return ApiResponseFactory.InternalError<bool>($"Error deleting API definition: {ex.Message}");
            }
        }
    }
}
