using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IPlanPricingService
    {
        Task<ApiResponse<PlanDetailDto>> GetPlanDetailAsync(int planId);
        Task<ApiResponse<bool>> UpdatePlanAppPricingsAsync(int planId, List<CreatePlanAppPricingDto> pricings);
        Task<ApiResponse<bool>> UpdatePlanApiPricingsAsync(int planId, List<CreatePlanApiPricingDto> pricings);
        Task<ApiResponse<bool>> UpdatePlanFeaturesAsync(int planId, List<CreatePlanFeatureDto> features);
    }
}
