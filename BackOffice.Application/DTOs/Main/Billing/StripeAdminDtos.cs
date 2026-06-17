namespace BackOffice.Application.DTOs.Main.Billing
{
    /// <summary>
    /// Phase 6: Super-admin changes a tenant's plan with explicit proration control.
    /// </summary>
    public class AdminChangePlanDto
    {
        public int NewPlanId { get; set; }

        /// <summary>
        /// Stripe proration_behavior. Valid: "create_prorations" (default), "none", "always_invoice".
        /// </summary>
        public string ProrationBehavior { get; set; } = "create_prorations";

        public string? Notes { get; set; }
    }

    public class AdminCancelDto
    {
        /// <summary>
        /// When true, cancel the Stripe subscription immediately (with prorated refund of unused time).
        /// When false (default), cancel_at_period_end — service continues until period end.
        /// </summary>
        public bool Immediately { get; set; } = false;

        public string? Notes { get; set; }
    }

    public class AdminPauseDto
    {
        /// <summary>
        /// Stripe pause_collection behavior. Valid: "keep_as_draft" (default — invoices created but unfinalized),
        /// "mark_uncollectible", "void".
        /// </summary>
        public string Behavior { get; set; } = "keep_as_draft";

        public string? Notes { get; set; }
    }

    /// <summary>
    /// Detailed Stripe state for a customer's subscription, returned to the super-admin UI.
    /// </summary>
    public class AdminSubscriptionDetailDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? StripeCustomerId { get; set; }
        public string? StripeSubscriptionId { get; set; }
        public int PlanId { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public decimal MonthlyAmount { get; set; }
        public string Status { get; set; } = string.Empty;          // domain status string
        public string? StripeStatus { get; set; }                   // Stripe's own status (active/past_due/paused/...)
        public DateTime? CurrentPeriodStart { get; set; }
        public DateTime? CurrentPeriodEnd { get; set; }
        public bool CancelAtPeriodEnd { get; set; }
        public DateTime? CanceledAt { get; set; }
        public string? PauseCollectionBehavior { get; set; }
        public string? DefaultPaymentMethodId { get; set; }
        public string? DefaultPaymentMethodBrand { get; set; }
        public string? DefaultPaymentMethodLast4 { get; set; }
        public DateTime? LastPaymentAt { get; set; }
        public bool IsPaid { get; set; }
    }
}
