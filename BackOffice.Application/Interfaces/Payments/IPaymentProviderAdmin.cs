using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.DTOs.Main.Billing.Payments;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Payments
{
    /// <summary>
    /// Super-admin operations on a tenant's subscription, abstracted across
    /// payment providers. Unlike <see cref="IPaymentProvider"/>, these methods
    /// take <c>customerId</c> explicitly (from the URL, not the JWT) so a
    /// super-admin can act on any tenant.
    ///
    /// Split from <see cref="IPaymentProvider"/> so providers that don't need
    /// an admin surface (or expose it differently) aren't forced to implement
    /// these. The Stripe adapter implements both.
    /// </summary>
    public interface IPaymentProviderAdmin
    {
        /// <summary>Which backend this admin adapter targets.</summary>
        PaymentProviderType ProviderType { get; }

        /// <summary>Detailed view of a tenant's subscription including provider-side state.</summary>
        Task<ApiResponse<SubscriptionDetailDto>> GetSubscriptionDetailAsync(int customerId);

        /// <summary>Change plan for a tenant. Admin picks the proration policy.</summary>
        Task<ApiResponse<bool>> ChangePlanAsync(int customerId, int adminUserId, AdminPlanChangeRequest request);

        /// <summary>Preview what the tenant would be charged if the plan changed today.</summary>
        Task<ApiResponse<UpcomingInvoicePreviewDto>> PreviewPlanChangeAsync(int customerId, int newPlanId);

        /// <summary>Cancel a tenant's subscription (graceful or immediate).</summary>
        Task<ApiResponse<bool>> CancelAsync(int customerId, int adminUserId, AdminCancelRequest request);

        /// <summary>Undo a pending cancel — re-enable auto-renewal.</summary>
        Task<ApiResponse<bool>> ReactivateAsync(int customerId, int adminUserId);

        /// <summary>Pause billing without canceling. Keeps subscription, stops charging.</summary>
        Task<ApiResponse<bool>> PauseAsync(int customerId, int adminUserId, AdminPauseRequest request);

        /// <summary>Resume after a pause.</summary>
        Task<ApiResponse<bool>> ResumeAsync(int customerId, int adminUserId);

        /// <summary>Force-refresh our DB state from the provider (debugging tool).</summary>
        Task<ApiResponse<bool>> SyncFromProviderAsync(int customerId);

        /// <summary>
        /// Backfill: fetch all invoices for this customer from the provider and
        /// upsert into our Invoices table. Captures hosted/PDF URLs so View
        /// works on historical invoices.
        /// </summary>
        Task<ApiResponse<int>> SyncInvoicesFromProviderAsync(int customerId);

        /// <summary>
        /// QA helper: create a real provider-side invoice (test mode only) with a
        /// small line item, finalize it, and mark it paid out-of-band so no real
        /// card is charged. Mirrored to our DB inline.
        /// </summary>
        Task<ApiResponse<InvoiceSummaryDto>> CreateTestInvoiceAsync(int customerId);
    }
}
