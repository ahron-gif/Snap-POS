namespace BackOffice.Application.DTOs.Main.Billing.Payments
{
    /// <summary>
    /// Provider-neutral counterpart of <c>AdminChangePlanDto</c>. Uses a typed
    /// <see cref="ProrationBehavior"/> instead of a Stripe-vocabulary string.
    /// </summary>
    public class AdminPlanChangeRequest
    {
        public int NewPlanId { get; set; }
        public ProrationBehavior Proration { get; set; } = ProrationBehavior.CreateProrations;
        public string? Notes { get; set; }
    }

    /// <summary>
    /// Provider-neutral counterpart of <c>AdminCancelDto</c>.
    /// </summary>
    public class AdminCancelRequest
    {
        /// <summary>
        /// When true, cancel the subscription immediately (with prorated refund of unused time
        /// if the provider supports it). When false (default), cancel at period end —
        /// service continues until <c>CurrentPeriodEnd</c>.
        /// </summary>
        public bool Immediately { get; set; } = false;

        public string? Notes { get; set; }
    }

    /// <summary>
    /// Provider-neutral counterpart of <c>AdminPauseDto</c>.
    /// </summary>
    public class AdminPauseRequest
    {
        public PauseBehavior Behavior { get; set; } = PauseBehavior.KeepAsDraft;
        public string? Notes { get; set; }
    }
}
