namespace BackOffice.Application.DTOs.Main.Billing
{
    public class PlanFeatureDto
    {
        public int Id { get; set; }
        public int PlanId { get; set; }
        public int? AppId { get; set; }
        public string Category { get; set; } = null!;
        public string FeatureName { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsEnabled { get; set; }
        public int SortOrder { get; set; }
    }

    public class CreatePlanFeatureDto
    {
        public int? AppId { get; set; }
        public string Category { get; set; } = null!;
        public string FeatureName { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsEnabled { get; set; }
        public int SortOrder { get; set; }
    }

    public class UpdatePlanFeatureDto
    {
        public int Id { get; set; }
        public int? AppId { get; set; }
        public string Category { get; set; } = null!;
        public string FeatureName { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsEnabled { get; set; }
        public int SortOrder { get; set; }
    }
}
