using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    /// <summary>
    /// Phase-1 service: keeps Stripe's product/price catalog in sync with our Plans table.
    /// Subscription billing requires every Plan to have a corresponding Stripe Price.
    /// Idempotent — safe to run repeatedly (won't create duplicate Stripe objects).
    /// </summary>
    public interface IStripeCatalogService
    {
        /// <summary>
        /// For every active Plan that lacks a Stripe Product/Price, creates them in
        /// Stripe and stores the IDs. Returns the number of Plans newly synced.
        /// Existing IDs are not overwritten.
        /// </summary>
        Task<ApiResponse<int>> SyncAllPlansAsync();

        /// <summary>
        /// Sync a single plan by Id (for use after creating or editing a Plan).
        /// </summary>
        Task<ApiResponse<bool>> SyncPlanAsync(int planId);
    }
}
