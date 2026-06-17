using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IStripeCheckoutService
    {
        /// <summary>
        /// Creates a Stripe Checkout Session for a plan upgrade and stores a
        /// PendingUpgrade row keyed by the session id. Returns the hosted-checkout URL.
        /// </summary>
        Task<ApiResponse<CheckoutSessionResultDto>> CreateUpgradeSessionAsync(
            int customerId,
            int requestedByUserId,
            CreateUpgradeSessionDto dto);

        /// <summary>
        /// Reads payment + plan-applied state for a given session, used by the
        /// frontend's success page to confirm the webhook has fired.
        /// </summary>
        Task<ApiResponse<CheckoutSessionStatusDto>> GetSessionStatusAsync(
            int customerId,
            string sessionId);

        /// <summary>
        /// Verifies a Stripe webhook payload's signature and dispatches it.
        /// Idempotent — processed event ids are recorded in StripeWebhookEvents.
        /// </summary>
        Task<ApiResponse<bool>> HandleWebhookAsync(string payload, string signatureHeader);

        /// <summary>
        /// Backstop for cases where Stripe's redirect to /licenses-billing?upgrade=success
        /// is lost (different port, ad blocker, popup blocker, browser back-button, etc.).
        /// Looks at every incomplete PendingUpgrade for this tenant, queries Stripe for
        /// each one's payment status, and applies the plan change for any that paid.
        /// Idempotent. Frontend calls this on every billing-page load.
        /// </summary>
        Task<ApiResponse<int>> ReconcilePendingAsync(int customerId);

        /// <summary>
        /// Phase 2: First-time subscribe. Creates a Stripe Checkout Session in
        /// mode=subscription using the Plan's pre-synced StripeMonthlyPriceId.
        /// After payment, Stripe creates a real recurring Subscription that
        /// auto-renews monthly. Webhooks mirror state back to our DB.
        /// </summary>
        Task<ApiResponse<CheckoutSessionResultDto>> CreateSubscribeSessionAsync(
            int customerId,
            int requestedByUserId,
            CreateSubscribeSessionDto dto);

        /// <summary>
        /// One-off Stripe Checkout (mode=payment) for an OpenAPI prepaid-credit top-up.
        /// Session metadata carries intent="credit_topup" and the amount; the
        /// checkout.session.completed webhook handler credits the tenant's wallet.
        /// </summary>
        Task<ApiResponse<CheckoutSessionResultDto>> CreateCreditTopUpSessionAsync(
            int customerId,
            int requestedByUserId,
            decimal amount);

        /// <summary>
        /// Polling-mode backstop for credit top-up. The frontend calls this after
        /// returning from Stripe Checkout. We query Stripe by session id; if payment
        /// is confirmed and the wallet hasn't yet been credited, we apply the top-up
        /// inline. Idempotent — the credit service de-dupes on PaymentIntentId so a
        /// late webhook will see the row and exit early. Required for local dev where
        /// webhooks aren't tunneled.
        /// </summary>
        Task<ApiResponse<bool>> ReconcileCreditTopUpAsync(int customerId, string sessionId);

        /// <summary>
        /// Broader backstop: list every recent Stripe Checkout Session for the tenant's
        /// Stripe Customer Id, find the ones with metadata.intent="credit_topup" AND
        /// payment_status="paid", and apply any that the wallet hasn't yet recorded.
        /// Called automatically on License &amp; Billing page load and via a manual
        /// "Recover pending payments" button. Idempotent (de-dupes on PaymentIntentId).
        /// Returns scan diagnostics so the panel can show why nothing was applied.
        /// </summary>
        Task<ApiResponse<CreditTopUpRecoveryResultDto>> RecoverPendingCreditTopUpsAsync(int customerId);

        /// <summary>
        /// Last-ditch manual recovery: the tenant pastes a Stripe Checkout Session ID
        /// from their Stripe Dashboard (typically because the auto-scan couldn't find
        /// the payment — usually a Customer-mapping mismatch). We fetch the session,
        /// verify it's paid, derive the amount from metadata or AmountTotal, and apply
        /// it to the CALLING tenant's wallet — bypassing the metadata customer_id
        /// check (the operator is vouching by pasting the ID). Idempotent on
        /// PaymentIntentId so re-clicks are safe. The override is logged at WARN.
        /// </summary>
        Task<ApiResponse<bool>> ApplyCreditTopUpBySessionIdAsync(int customerId, string sessionId);

        /// <summary>
        /// Guarantee a Stripe Customer exists for this BackOffice tenant. Returns the
        /// linked cus_… id, creating + linking one if needed. Three-step lookup:
        ///   1. If <c>Customer.StripeCustomerId</c> is already set, return it.
        ///   2. Otherwise, search Stripe by metadata["customer_id"] to find an
        ///      orphan (created by a prior lazy-create that lost its DB write).
        ///   3. Otherwise, create a new Stripe Customer and persist the link.
        /// Called by every Stripe checkout path (top-up, upgrade, subscribe, add-on)
        /// to eliminate the race condition where two concurrent clicks each create
        /// a fresh Stripe Customer.
        /// </summary>
        Task<ApiResponse<EnsureStripeCustomerResultDto>> EnsureStripeCustomerAsync(int customerId);

        /// <summary>
        /// Dry-run diagnostic for a single Checkout Session: returns everything
        /// Stripe knows about the session, everything BackOffice knows about the
        /// caller, the four match checks (paid / intent / customer linkage / metadata
        /// customer_id), the idempotency state, and a definitive "would Apply
        /// succeed?" verdict with a blocker list. Read-only — no writes.
        /// </summary>
        Task<ApiResponse<CreditTopUpTraceDto>> TraceCreditTopUpAsync(int customerId, string sessionId);

        // ─── Phase 3: Direct subscription management (no Checkout redirect) ───

        /// <summary>
        /// Switch the customer's existing subscription to a different Plan via
        /// stripe.subscriptions.update. Stripe charges/credits proration immediately
        /// against the saved payment method.
        /// </summary>
        Task<ApiResponse<bool>> ChangeSubscriptionPlanAsync(int customerId, ChangeSubscriptionPlanDto dto);

        /// <summary>
        /// Returns a preview of "what will the customer pay today" if they switched
        /// to the given NewPlanId right now. Used by the UI before confirming.
        /// </summary>
        Task<ApiResponse<UpcomingInvoicePreviewDto>> PreviewPlanChangeAsync(int customerId, int newPlanId);

        /// <summary>
        /// Cancel at period end — service continues until CurrentPeriodEnd.
        /// </summary>
        Task<ApiResponse<bool>> CancelSubscriptionAsync(int customerId);

        /// <summary>
        /// Undo a cancel-at-period-end. Subscription resumes auto-renewing.
        /// </summary>
        Task<ApiResponse<bool>> ReactivateSubscriptionAsync(int customerId);

        /// <summary>
        /// Returns a Stripe Customer Portal URL. The portal lets the user update
        /// their payment method, view invoices, cancel/reactivate — all on a
        /// Stripe-hosted page so we don't have to build that UI ourselves.
        /// </summary>
        Task<ApiResponse<CustomerPortalSessionDto>> CreateCustomerPortalSessionAsync(int customerId);
    }
}
