namespace BackOffice.Application.DTOs.Main.Billing
{
    public class PlanApiPricingDto
    {
        public int Id { get; set; }
        public int PlanId { get; set; }
        public int ApiDefinitionId { get; set; }
        public string ApiName { get; set; } = null!;
        public decimal RatePerCall { get; set; }
        public int FreeTierCalls { get; set; }
        public int? MaxCallsPerMonth { get; set; }
        public bool IsIncluded { get; set; }
    }

    public class CreatePlanApiPricingDto
    {
        public int ApiDefinitionId { get; set; }
        public decimal RatePerCall { get; set; }
        public int FreeTierCalls { get; set; }
        public int? MaxCallsPerMonth { get; set; }
        public bool IsIncluded { get; set; }
    }

    public class UpdatePlanApiPricingDto
    {
        public int Id { get; set; }
        public int ApiDefinitionId { get; set; }
        public decimal RatePerCall { get; set; }
        public int FreeTierCalls { get; set; }
        public int? MaxCallsPerMonth { get; set; }
        public bool IsIncluded { get; set; }
    }
}
