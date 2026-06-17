using BackOffice.Domain.Enums;

namespace BackOffice.Application.DTOs.Main.Billing
{
    public class BillingStatusDto
    {
        public SubscriptionStatus SubscriptionStatus { get; set; }
        public string? PlanName { get; set; }
        public DateTime? GracePeriodEndsAt { get; set; }
        public DateTime? SuspendedAt { get; set; }
        public bool IsOverdue { get; set; }
        public int? DaysUntilSuspension { get; set; }
    }
}
