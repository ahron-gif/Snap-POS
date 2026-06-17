namespace BackOffice.Application.DTOs.Main.Billing
{
    public class CustomerAppLicenseDto
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        public int AppId { get; set; }
        public string? AppName { get; set; }
        public string? DeviceLabel { get; set; }
        public DateTime ActivatedAt { get; set; }
        public DateTime? BillingEndsAt { get; set; }
        public DateTime? RemovalRequestedAt { get; set; }
        public bool IsActive => BillingEndsAt == null;
        public bool IsPlanBaseline { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AddLicenseDto
    {
        public int AppId { get; set; }
        public string? DeviceLabel { get; set; }
    }

    public class AddLicenseAdminDto : AddLicenseDto
    {
        public int CustomerId { get; set; }
    }

    public class LicenseSummaryByAppDto
    {
        public int AppId { get; set; }
        public string? AppName { get; set; }
        public int ActiveCount { get; set; }
        public int PendingRemovalCount { get; set; }
    }

    public class LicenseSummaryDto
    {
        public int CustomerId { get; set; }
        public DateTime CycleStart { get; set; }
        public DateTime CycleEnd { get; set; }
        public List<LicenseSummaryByAppDto> ByApp { get; set; } = new();
    }
}
