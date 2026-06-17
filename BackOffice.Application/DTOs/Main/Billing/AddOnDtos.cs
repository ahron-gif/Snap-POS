namespace BackOffice.Application.DTOs.Main.Billing
{
    /// <summary>
    /// One line in an add-on request — the desired TOTAL overage quantity for an
    /// App, not a delta. Idempotent on retry: re-POSTing the same request after
    /// network failure produces the same end state.
    /// </summary>
    public class AddOnItemDto
    {
        /// <summary>The App (POS, Picking, Price Checker, etc.) this line targets.</summary>
        public int AppId { get; set; }

        /// <summary>
        /// Total quantity of overage units (devices/users beyond the plan's FreeUnits)
        /// the user wants AFTER applying the change. Used to set the Stripe Subscription
        /// Item quantity. 0 means "remove the add-on entirely". Capped server-side by
        /// PlanAppPricing.MaxUnits.
        /// </summary>
        public int Quantity { get; set; }

        /// <summary>
        /// Optional — the delta the user JUST added (or removed via negative) in this
        /// session, computed locally by the frontend's +/- buttons. When provided, the
        /// backend uses THIS for the prorated charge math instead of comparing
        /// <see cref="Quantity"/> against the live Stripe subscription state. This is
        /// the source of truth for what to charge the user, because:
        ///
        ///  - The frontend knows exactly what the user clicked in this session.
        ///  - The Stripe subscription may have stale overage items from prior testing,
        ///    cancelled flows, or out-of-band Stripe changes — none of which the user
        ///    intends to pay for again.
        ///
        /// When omitted, the backend falls back to the Stripe-state diff (legacy behavior).
        /// </summary>
        public int? AddedQuantity { get; set; }

        /// <summary>
        /// Optional — specific <c>CustomerAppLicense.Id</c> values the user marked for
        /// removal in this session (the - button picks LIFO from active rows). On
        /// payment success the backend applies these via
        /// <c>ICustomerAppLicenseService.RequestRemovalAsync</c> so license-row state
        /// stays in sync with the Stripe-side quantity change.
        /// </summary>
        public List<int>? RemoveLicenseIds { get; set; }
    }

    /// <summary>
    /// Multi-item add-on request. Used for both the dry-run preview and the
    /// real Checkout-session creation. The "Save License Changes" button on the
    /// licenses-and-billing page sends ALL line changes in one request so the
    /// user is charged a single Checkout session that covers every adjustment.
    /// </summary>
    public class AddOnRequestDto
    {
        public List<AddOnItemDto> Items { get; set; } = new();

        public string? Notes { get; set; }
    }
}
