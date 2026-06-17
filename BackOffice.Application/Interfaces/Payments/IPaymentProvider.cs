using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Payments
{
    /// <summary>
    /// Adapter contract for a payment backend (Stripe, PayPal, Square, …).
    ///
    /// All concrete implementations live in the Persistence layer. The active
    /// provider for a given tenant is resolved at runtime via
    /// <see cref="IPaymentProviderFactory"/> using the tenant's stored
    /// <see cref="PaymentProviderType"/>.
    ///
    /// Methods reuse the existing checkout DTOs because those are already
    /// provider-neutral (<c>SessionId</c>/<c>Url</c>/etc. — no Stripe types leak).
    /// Admin-only operations live on <see cref="IPaymentProviderAdmin"/>.
    /// </summary>
    public interface IPaymentProvider
    {
        /// <summary>Which backend this adapter represents. Used by the factory to route calls.</summary>
        PaymentProviderType ProviderType { get; }

        // ─── Catalog sync ───────────────────────────────────────────────
        // Most providers require us to pre-register Products/Prices before a
        // subscription can be created against them. Adapters whose provider
        // doesn't need this (e.g. Manual) can return a success no-op.

        /// <summary>Sync every active Plan into the provider's catalog. Idempotent.</summary>
        Task<ApiResponse<int>> SyncAllPlansAsync();

        /// <summary>Sync a single Plan into the provider's catalog. Idempotent.</summary>
        Task<ApiResponse<bool>> SyncPlanAsync(int planId);

        // ─── Hosted checkout (redirect flow) ────────────────────────────

        /// <summary>First-time subscribe — creates a hosted checkout session in subscription mode.</summary>
        Task<ApiResponse<CheckoutSessionResultDto>> CreateSubscribeSessionAsync(
            int customerId, int requestedByUserId, CreateSubscribeSessionDto dto);

        /// <summary>Plan upgrade via hosted checkout (one-shot payment for the prorated delta).</summary>
        Task<ApiResponse<CheckoutSessionResultDto>> CreateUpgradeSessionAsync(
            int customerId, int requestedByUserId, CreateUpgradeSessionDto dto);

        /// <summary>Poll session payment + plan-applied state from the success page.</summary>
        Task<ApiResponse<CheckoutSessionStatusDto>> GetSessionStatusAsync(int customerId, string sessionId);

        /// <summary>
        /// Backstop for lost webhooks/redirects: scan pending sessions, query the provider for
        /// each one's payment status, and apply any that paid. Idempotent. Frontend calls this
        /// on every billing-page load.
        /// </summary>
        Task<ApiResponse<int>> ReconcilePendingAsync(int customerId);

        // ─── Direct subscription management (no redirect) ───────────────

        /// <summary>Switch an existing subscription to a different Plan with provider-side proration.</summary>
        Task<ApiResponse<bool>> ChangeSubscriptionPlanAsync(int customerId, ChangeSubscriptionPlanDto dto);

        /// <summary>Preview what the customer will be charged today (or credited) if they switch now.</summary>
        Task<ApiResponse<UpcomingInvoicePreviewDto>> PreviewPlanChangeAsync(int customerId, int newPlanId);

        /// <summary>Cancel at period end. Service continues until <c>CurrentPeriodEnd</c>.</summary>
        Task<ApiResponse<bool>> CancelSubscriptionAsync(int customerId);

        /// <summary>Undo a pending cancel — subscription resumes auto-renewing.</summary>
        Task<ApiResponse<bool>> ReactivateSubscriptionAsync(int customerId);

        // ─── Hosted billing portal (optional capability) ────────────────

        /// <summary>
        /// Returns a hosted-billing-portal URL where the user can update card,
        /// view invoices, cancel/reactivate. Adapters whose provider has no such
        /// portal should return a 501/NotImplemented in <see cref="ApiResponse{T}"/>.
        /// </summary>
        Task<ApiResponse<CustomerPortalSessionDto>> CreateCustomerPortalSessionAsync(int customerId);

        // ─── Webhooks ───────────────────────────────────────────────────

        /// <summary>
        /// Verifies a provider webhook payload's signature and dispatches it.
        /// Idempotent — processed event ids are recorded so retries are safe.
        /// The webhook controller picks the right adapter via the provider's
        /// route prefix (e.g. /webhooks/stripe vs /webhooks/paypal).
        /// </summary>
        Task<ApiResponse<bool>> HandleWebhookAsync(string payload, string signatureHeader);
    }
}
