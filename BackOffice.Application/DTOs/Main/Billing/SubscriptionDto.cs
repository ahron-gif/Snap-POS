using BackOffice.Domain.Enums;

namespace BackOffice.Application.DTOs.Main.Billing
{
    public class CustomerSubscriptionDetailDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = null!;
        public int PlanId { get; set; }
        public string PlanName { get; set; } = null!;
        public PlanTier? PlanTier { get; set; }
        public SubscriptionStatus SubscriptionStatus { get; set; }
        public DateTime? SubscriptionStartDate { get; set; }
        public DateTime? SubscriptionEndDate { get; set; }
        public DateTime? GracePeriodEndsAt { get; set; }
        public DateTime? SuspendedAt { get; set; }
        public int BillingCycleMonths { get; set; }
        public decimal MonthlyAmount { get; set; }
        public bool IsPaid { get; set; }
        public DateTime? LastPaymentAt { get; set; }

        // Phase 2: real Stripe Subscriptions
        public string? StripeSubscriptionId { get; set; }
        public DateTime? CurrentPeriodStart { get; set; }
        public DateTime? CurrentPeriodEnd { get; set; }
        public bool CancelAtPeriodEnd { get; set; }
        public DateTime? CanceledAt { get; set; }
    }

    public class ChangeSubscriptionDto
    {
        public int CustomerId { get; set; }
        public int NewPlanId { get; set; }
        public DateTime? EffectiveDate { get; set; }
        public string? Notes { get; set; }
    }

    public class CustomerAppOverrideDto
    {
        public int CustomerId { get; set; }
        public int AppId { get; set; }
        public decimal? PriceOverride { get; set; }
        public int? DeviceLimitOverride { get; set; }
        public int? FreeTierOverride { get; set; }
        public bool IsEnabled { get; set; }
    }

    public class CustomerApiOverrideDto
    {
        public int CustomerId { get; set; }
        public int ApiDefinitionId { get; set; }
        public decimal? RateOverride { get; set; }
        public int? FreeTierOverride { get; set; }
        public int? MaxCallsOverride { get; set; }
        public bool IsEnabled { get; set; }
    }

    public class SubscriptionHistoryDto
    {
        public int Id { get; set; }
        public string PlanName { get; set; } = null!;
        public SubscriptionAction Action { get; set; }
        public string? PreviousPlanName { get; set; }
        public decimal MonthlyAmount { get; set; }
        public DateTime EffectiveDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? Notes { get; set; }
        public string? ChangedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
