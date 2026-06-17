using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    /// <summary>
    /// Phase 6: super-admin operations on tenant subscriptions. Unlike the tenant-facing
    /// IStripeCheckoutService methods, these accept customerId explicitly (from the URL,
    /// not from the JWT) so a super-admin can act on any tenant.
    ///
    /// All operations are Stripe-aware: if the tenant has a real Stripe subscription
    /// (StripeSubscriptionId set), changes go through Stripe; otherwise they fall back
    /// to a direct DB update (legacy behavior) and surface a warning to the caller.
    /// </summary>
    public interface IStripeAdminService
    {
        /// <summary>Get a detailed view of a tenant's subscription state including Stripe sub data.</summary>
        Task<ApiResponse<AdminSubscriptionDetailDto>> GetSubscriptionDetailAsync(int customerId);

        /// <summary>Change plan for a tenant. Admin picks proration behavior.</summary>
        Task<ApiResponse<bool>> ChangePlanAsync(int customerId, int adminUserId, AdminChangePlanDto dto);

        /// <summary>Preview what the tenant would be charged if the plan changed today.</summary>
        Task<ApiResponse<UpcomingInvoicePreviewDto>> PreviewPlanChangeAsync(int customerId, int newPlanId);

        /// <summary>Cancel a tenant's subscription (graceful or immediate).</summary>
        Task<ApiResponse<bool>> CancelAsync(int customerId, int adminUserId, AdminCancelDto dto);

        /// <summary>Undo a pending cancel — re-enable auto-renewal.</summary>
        Task<ApiResponse<bool>> ReactivateAsync(int customerId, int adminUserId);

        /// <summary>Pause Stripe billing without canceling. Keeps subscription, stops charging.</summary>
        Task<ApiResponse<bool>> PauseAsync(int customerId, int adminUserId, AdminPauseDto dto);

        /// <summary>Resume after a pause.</summary>
        Task<ApiResponse<bool>> ResumeAsync(int customerId, int adminUserId);

        /// <summary>Force-refresh our DB state from Stripe (debugging tool).</summary>
        Task<ApiResponse<bool>> SyncFromStripeAsync(int customerId);

        /// <summary>
        /// Backfill: fetch all Stripe invoices for this customer and upsert into our Invoices table.
        /// Captures HostedInvoiceUrl + InvoicePdfUrl so the View button works on historical invoices.
        /// </summary>
        Task<ApiResponse<int>> SyncInvoicesFromStripeAsync(int customerId);

        /// <summary>
        /// QA helper: create a real Stripe invoice (test mode only) for the customer with a
        /// small line item, finalize it, and mark it paid out-of-band so no real card is charged.
        /// The invoice is mirrored to our DB inline so it shows in the invoices list immediately,
        /// and View opens the Stripe-hosted page.
        /// </summary>
        Task<ApiResponse<InvoiceSummaryDto>> CreateTestInvoiceAsync(int customerId);
    }
}
