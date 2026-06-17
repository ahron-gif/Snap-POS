using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    /// <summary>
    /// Mid-cycle add-on billing. Mirrors the plan-upgrade flow exactly:
    ///   1. Frontend POSTs the desired quantities → service creates a Stripe
    ///      Checkout Session (mode=payment) for the prorated total + a
    ///      <c>PendingAddOn</c> row keyed by session id.
    ///   2. Frontend redirects to <c>session.Url</c>; user pays at Stripe.
    ///   3. <c>checkout.session.completed</c> webhook (or the status-poll
    ///      backstop, or <see cref="ReconcilePendingAsync"/>) calls
    ///      <c>SubscriptionService.UpdateAsync</c> to add/update the recurring
    ///      Subscription Items with <c>proration_behavior=none</c> — the
    ///      proration was already collected via Checkout.
    ///   4. Local DB state (SubscriptionAddOns) is mirrored.
    ///
    /// If the user closes Stripe without paying, the PendingAddOn row stays
    /// and no subscription change occurs. The user can retry from the UI.
    /// </summary>
    public interface IAddOnService
    {
        /// <summary>
        /// Dry-run preview of the prorated total for the proposed quantity changes.
        /// Stripe-side via Invoices.CreatePreviewAsync — nothing is charged or
        /// persisted. Frontend calls this when the user adjusts the +/- buttons
        /// to drive the "Estimated Bill" panel.
        /// </summary>
        Task<ApiResponse<UpcomingInvoicePreviewDto>> PreviewAsync(int customerId, AddOnRequestDto dto);

        /// <summary>
        /// Creates a Stripe Checkout Session (mode=payment) for the prorated total
        /// of the proposed changes and stores a PendingAddOn row keyed by session id.
        /// Frontend redirects window.location to the returned Url.
        ///
        /// Returns BadRequest if no changes vs. current state, or if Stripe's
        /// preview computes a total of 0 (nothing to charge — call ApplyImmediateAsync
        /// instead, or skip Checkout entirely on the UI side).
        /// </summary>
        Task<ApiResponse<CheckoutSessionResultDto>> CreateCheckoutSessionAsync(
            int customerId, int requestedByUserId, AddOnRequestDto dto);

        /// <summary>
        /// Status of a previously-created add-on Checkout Session. The frontend's
        /// success page polls this until <c>Applied=true</c>. Idempotent — also
        /// runs the apply step inline if Stripe shows the session as paid and we
        /// haven't reflected it yet (handles missed/late webhooks for local dev).
        /// </summary>
        Task<ApiResponse<CheckoutSessionStatusDto>> GetSessionStatusAsync(int customerId, string sessionId);

        /// <summary>
        /// Backstop reconciliation. Scans every incomplete PendingAddOn for this
        /// customer, queries Stripe for each session's payment status, and applies
        /// any that are paid. Idempotent. Frontend calls this on every billing-page
        /// load (same pattern as ReconcilePendingAsync for upgrades) so changes
        /// are applied even if Stripe's redirect or webhook never reached us.
        /// </summary>
        Task<ApiResponse<int>> ReconcilePendingAsync(int customerId);

        /// <summary>
        /// Webhook entry point — invoked by <c>StripeCheckoutService</c> when a
        /// <c>checkout.session.completed</c> event for an add-on session arrives.
        /// Calls <c>SubscriptionService.UpdateAsync</c> with the items in the
        /// matching <c>PendingAddOn</c> row, marks it complete, and mirrors
        /// <c>SubscriptionAddOns</c>. Idempotent — guarded by <c>CompletedAt</c>.
        /// </summary>
        Task ApplyAddOnCheckoutCompletedAsync(Stripe.Checkout.Session session);
    }
}
