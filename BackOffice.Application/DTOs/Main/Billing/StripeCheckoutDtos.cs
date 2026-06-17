namespace BackOffice.Application.DTOs.Main.Billing
{
    /// <summary>
    /// Request to create a Stripe Checkout Session for a plan upgrade.
    /// </summary>
    public class CreateUpgradeSessionDto
    {
        public int NewPlanId { get; set; }
        public string? Notes { get; set; }
    }

    /// <summary>
    /// Returned to the frontend so it can redirect to Stripe-hosted Checkout.
    /// </summary>
    public class CheckoutSessionResultDto
    {
        public string SessionId { get; set; } = null!;
        public string Url { get; set; } = null!;
    }

    /// <summary>
    /// Polled by the success page until the webhook flips IsPaid.
    /// </summary>
    public class CheckoutSessionStatusDto
    {
        public string SessionId { get; set; } = null!;
        public bool IsPaid { get; set; }
        public bool PlanApplied { get; set; }
        public string? PaymentStatus { get; set; }
    }

    /// <summary>
    /// Phase 2: first-time subscribe flow. User picks a plan and we create
    /// a Stripe Checkout Session in mode=subscription. Stripe will save the
    /// payment method and create a recurring Subscription that auto-renews.
    /// </summary>
    public class CreateSubscribeSessionDto
    {
        public int PlanId { get; set; }
        public string? Notes { get; set; }
    }

    // ─── Phase 3: Direct subscription management (no Checkout redirect) ───

    /// <summary>
    /// Switch an existing subscription to a different Plan. Stripe handles proration:
    /// upgrade → invoiced + charged immediately; downgrade → credit on next invoice.
    /// </summary>
    public class ChangeSubscriptionPlanDto
    {
        public int NewPlanId { get; set; }
        public string? Notes { get; set; }
    }

    /// <summary>
    /// Preview what the customer will be charged today (or credited) if the plan
    /// changes to NewPlanId. Returned to the UI before user confirms.
    /// </summary>
    public class UpcomingInvoicePreviewDto
    {
        public decimal AmountDueNow { get; set; }
        public decimal NextCycleAmount { get; set; }
        public DateTime? NextBillingDate { get; set; }
        public string Currency { get; set; } = "usd";
        public List<UpcomingInvoiceLineDto> Lines { get; set; } = new();
    }

    public class UpcomingInvoiceLineDto
    {
        public string Description { get; set; } = null!;
        public decimal Amount { get; set; }
        public bool IsProration { get; set; }
    }

    /// <summary>
    /// Returned by /CustomerPortalSession — frontend redirects to this URL.
    /// Stripe-hosted page lets users update card, view invoices, cancel/reactivate.
    /// </summary>
    public class CustomerPortalSessionDto
    {
        public string Url { get; set; } = null!;
    }
}
