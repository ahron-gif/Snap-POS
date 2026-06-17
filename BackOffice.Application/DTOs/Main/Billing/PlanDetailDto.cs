using BackOffice.Domain.Enums;

namespace BackOffice.Application.DTOs.Main.Billing
{
    public class PlanDetailDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public PlanTier? Tier { get; set; }
        public int MaxUsers { get; set; }
        public BillingCycle BillingCycle { get; set; }
        public decimal Price { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<PlanAppPricingDto> AppPricings { get; set; } = new();
        public List<PlanApiPricingDto> ApiPricings { get; set; } = new();
        public List<PlanFeatureDto> Features { get; set; } = new();
        public List<int> ModuleIds { get; set; } = new();
    }
}
