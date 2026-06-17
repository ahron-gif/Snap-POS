using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    public class PlanPricingService : IPlanPricingService
    {
        private readonly MainDBContext _dbContext;
        private readonly ILogger<PlanPricingService> _logger;

        public PlanPricingService(
            MainDBContext dbContext,
            ILogger<PlanPricingService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<ApiResponse<PlanDetailDto>> GetPlanDetailAsync(int planId)
        {
            try
            {
                var plan = await _dbContext.Plans
                    .Include(p => p.PlanAppPricings)
                    .Include(p => p.PlanApiPricings).ThenInclude(pap => pap.ApiDefinition)
                    .Include(p => p.PlanFeatures)
                    .Include(p => p.PlanModules)
                    .FirstOrDefaultAsync(p => p.Id == planId);

                // Load app names separately since App nav is not mapped via FK
                var appIds = plan?.PlanAppPricings.Select(p => p.AppId).Distinct().ToList() ?? new List<int>();
                var appNames = appIds.Count > 0
                    ? await _dbContext.Apps.Where(a => appIds.Contains(a.AppId)).ToDictionaryAsync(a => a.AppId, a => a.AppName)
                    : new Dictionary<int, string>();

                if (plan == null)
                    return ApiResponseFactory.NotFound<PlanDetailDto>("Plan not found.");

                var dto = new PlanDetailDto
                {
                    Id = plan.Id,
                    Name = plan.Name,
                    Code = plan.Code,
                    Description = plan.Description,
                    Tier = plan.Tier,
                    MaxUsers = plan.MaxUsers,
                    BillingCycle = plan.BillingCycle,
                    Price = plan.Price,
                    SortOrder = plan.SortOrder,
                    IsActive = plan.IsActive,
                    CreatedAt = plan.CreatedAt,
                    UpdatedAt = plan.UpdatedAt,
                    AppPricings = plan.PlanAppPricings.Select(pap => new PlanAppPricingDto
                    {
                        Id = pap.Id,
                        PlanId = pap.PlanId,
                        AppId = pap.AppId,
                        AppName = appNames.GetValueOrDefault(pap.AppId, $"App {pap.AppId}"),
                        PricingModel = pap.PricingModel,
                        PricePerUnit = pap.PricePerUnit,
                        FreeUnits = pap.FreeUnits,
                        MaxUnits = pap.MaxUnits,
                        IsIncluded = pap.IsIncluded
                    }).ToList(),
                    ApiPricings = plan.PlanApiPricings.Select(pap => new PlanApiPricingDto
                    {
                        Id = pap.Id,
                        PlanId = pap.PlanId,
                        ApiDefinitionId = pap.ApiDefinitionId,
                        ApiName = pap.ApiDefinition?.Name ?? "",
                        RatePerCall = pap.RatePerCall,
                        FreeTierCalls = pap.FreeTierCalls,
                        MaxCallsPerMonth = pap.MaxCallsPerMonth,
                        IsIncluded = pap.IsIncluded
                    }).ToList(),
                    Features = plan.PlanFeatures.Select(pf => new PlanFeatureDto
                    {
                        Id = pf.Id,
                        PlanId = pf.PlanId,
                        AppId = pf.AppId,
                        Category = pf.Category,
                        FeatureName = pf.FeatureName,
                        Description = pf.Description,
                        IsEnabled = pf.IsEnabled,
                        SortOrder = pf.SortOrder
                    }).ToList(),
                    ModuleIds = plan.PlanModules
                        .Where(pm => pm.IsEnabled)
                        .Select(pm => pm.ModuleId)
                        .ToList()
                };

                return ApiResponseFactory.Success(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching plan detail for {PlanId}", planId);
                return ApiResponseFactory.InternalError<PlanDetailDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> UpdatePlanAppPricingsAsync(int planId, List<CreatePlanAppPricingDto> pricings)
        {
            try
            {
                var plan = await _dbContext.Plans.FindAsync(planId);
                if (plan == null)
                    return ApiResponseFactory.NotFound<bool>("Plan not found.");

                var existing = await _dbContext.PlanAppPricings
                    .Where(x => x.PlanId == planId)
                    .ToListAsync();

                _dbContext.PlanAppPricings.RemoveRange(existing);

                var newEntities = pricings.Select(p => new PlanAppPricing
                {
                    PlanId = planId,
                    AppId = p.AppId,
                    PricingModel = p.PricingModel,
                    PricePerUnit = p.PricePerUnit,
                    FreeUnits = p.FreeUnits,
                    MaxUnits = p.MaxUnits,
                    IsIncluded = p.IsIncluded,
                    CreatedAt = DateTime.UtcNow
                }).ToList();

                await _dbContext.PlanAppPricings.AddRangeAsync(newEntities);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Plan app pricings updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating app pricings for plan {PlanId}", planId);
                return ApiResponseFactory.InternalError<bool>($"Error updating plan app pricings: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdatePlanApiPricingsAsync(int planId, List<CreatePlanApiPricingDto> pricings)
        {
            try
            {
                var plan = await _dbContext.Plans.FindAsync(planId);
                if (plan == null)
                    return ApiResponseFactory.NotFound<bool>("Plan not found.");

                var existing = await _dbContext.PlanApiPricings
                    .Where(x => x.PlanId == planId)
                    .ToListAsync();

                _dbContext.PlanApiPricings.RemoveRange(existing);

                var newEntities = pricings.Select(p => new PlanApiPricing
                {
                    PlanId = planId,
                    ApiDefinitionId = p.ApiDefinitionId,
                    RatePerCall = p.RatePerCall,
                    FreeTierCalls = p.FreeTierCalls,
                    MaxCallsPerMonth = p.MaxCallsPerMonth,
                    IsIncluded = p.IsIncluded,
                    CreatedAt = DateTime.UtcNow
                }).ToList();

                await _dbContext.PlanApiPricings.AddRangeAsync(newEntities);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Plan API pricings updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating API pricings for plan {PlanId}", planId);
                return ApiResponseFactory.InternalError<bool>($"Error updating plan API pricings: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdatePlanFeaturesAsync(int planId, List<CreatePlanFeatureDto> features)
        {
            try
            {
                var plan = await _dbContext.Plans.FindAsync(planId);
                if (plan == null)
                    return ApiResponseFactory.NotFound<bool>("Plan not found.");

                var existing = await _dbContext.PlanFeatures
                    .Where(x => x.PlanId == planId)
                    .ToListAsync();

                _dbContext.PlanFeatures.RemoveRange(existing);

                var newEntities = features.Select(f => new PlanFeature
                {
                    PlanId = planId,
                    AppId = f.AppId,
                    Category = f.Category,
                    FeatureName = f.FeatureName,
                    Description = f.Description,
                    IsEnabled = f.IsEnabled,
                    SortOrder = f.SortOrder,
                    CreatedAt = DateTime.UtcNow
                }).ToList();

                await _dbContext.PlanFeatures.AddRangeAsync(newEntities);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Plan features updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating features for plan {PlanId}", planId);
                return ApiResponseFactory.InternalError<bool>($"Error updating plan features: {ex.Message}");
            }
        }
    }
}
