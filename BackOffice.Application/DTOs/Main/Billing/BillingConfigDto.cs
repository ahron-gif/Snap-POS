namespace BackOffice.Application.DTOs.Main.Billing
{
    public class BillingConfigDto
    {
        public int Id { get; set; }
        public string ConfigKey { get; set; } = null!;
        public string ConfigValue { get; set; } = null!;
        public string? Description { get; set; }
    }

    public class UpdateBillingConfigDto
    {
        public string ConfigKey { get; set; } = null!;
        public string ConfigValue { get; set; } = null!;
    }
}
