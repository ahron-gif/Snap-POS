namespace BackOffice.Application.DTOs.Main.Billing
{
    public class PlanAppPricingDto
    {
        public int Id { get; set; }
        public int PlanId { get; set; }
        public int AppId { get; set; }
        public string AppName { get; set; } = null!;
        public string PricingModel { get; set; } = null!;
        public decimal PricePerUnit { get; set; }
        public int FreeUnits { get; set; }
        public int? MaxUnits { get; set; }
        public bool IsIncluded { get; set; }
    }

    public class CreatePlanAppPricingDto
    {
        public int AppId { get; set; }
        public string PricingModel { get; set; } = null!;
        public decimal PricePerUnit { get; set; }
        public int FreeUnits { get; set; }
        public int? MaxUnits { get; set; }
        public bool IsIncluded { get; set; }
    }

    public class UpdatePlanAppPricingDto
    {
        public int Id { get; set; }
        public int AppId { get; set; }
        public string PricingModel { get; set; } = null!;
        public decimal PricePerUnit { get; set; }
        public int FreeUnits { get; set; }
        public int? MaxUnits { get; set; }
        public bool IsIncluded { get; set; }
    }
}
