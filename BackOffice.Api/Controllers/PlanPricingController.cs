using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PlanPricingController : ControllerBase
    {
        private readonly IPlanPricingService _planPricingService;
        private readonly IBillingConfigService _billingConfigService;

        public PlanPricingController(
            IPlanPricingService planPricingService,
            IBillingConfigService billingConfigService)
        {
            _planPricingService = planPricingService;
            _billingConfigService = billingConfigService;
        }

        // --- Plan Detail (with all pricings + features) ---

        [HttpGet("Plan/{planId}")]
        public async Task<IActionResult> GetPlanDetail(int planId)
        {
            var result = await _planPricingService.GetPlanDetailAsync(planId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Plan/{planId}/AppPricings")]
        public async Task<IActionResult> UpdatePlanAppPricings(int planId, [FromBody] List<CreatePlanAppPricingDto> pricings)
        {
            var result = await _planPricingService.UpdatePlanAppPricingsAsync(planId, pricings);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Plan/{planId}/ApiPricings")]
        public async Task<IActionResult> UpdatePlanApiPricings(int planId, [FromBody] List<CreatePlanApiPricingDto> pricings)
        {
            var result = await _planPricingService.UpdatePlanApiPricingsAsync(planId, pricings);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Plan/{planId}/Features")]
        public async Task<IActionResult> UpdatePlanFeatures(int planId, [FromBody] List<CreatePlanFeatureDto> features)
        {
            var result = await _planPricingService.UpdatePlanFeaturesAsync(planId, features);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        // --- Billing Configs ---

        [HttpGet("Configs")]
        public async Task<IActionResult> GetAllConfigs()
        {
            var result = await _billingConfigService.GetAllConfigsAsync();
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Configs")]
        public async Task<IActionResult> UpdateConfig([FromBody] UpdateBillingConfigDto dto)
        {
            var updatedBy = GetUserIdFromClaims();
            var result = await _billingConfigService.UpdateConfigAsync(dto, updatedBy);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }
    }
}
