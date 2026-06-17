namespace BackOffice.Application.DTOs.Main.Billing
{
    public class LicenseValidationRequestDto
    {
        public Guid Key { get; set; }
    }

    public class LicenseValidationResponseDto
    {
        public bool IsValid { get; set; }
        public string? Reason { get; set; }
        public string? CustomerName { get; set; }
        public string? PlanName { get; set; }
        public List<int> AllowedAppIds { get; set; } = new();
    }
}
