using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    /// <summary>
    /// OpenAPI prepaid-credit wallet operations. The wallet pays for metered API
    /// calls past the one-time free quota (configurable by superadmin per
    /// ApiDefinition). Tenants top up via Stripe Checkout; superadmins can adjust
    /// manually. See README.Metering.md in RDT.Connectors.API for the metering
    /// contract.
    /// </summary>
    public interface ICustomerCreditService
    {
        /// <summary>Wallet snapshot + per-ApiDefinition free-tier consumption. Used by
        /// the License & Billing page and by superadmin views.</summary>
        Task<ApiResponse<CreditBalanceDto>> GetBalanceAsync(int customerId);

        /// <summary>Atomically check the customer's free quota + balance, debit if
        /// applicable, and record an ApiUsageLog row. Called once per metered
        /// connector-API request. The whole operation is one SQL transaction.</summary>
        Task<ApiResponse<CheckAndRecordResultDto>> CheckAndRecordApiCallAsync(
            int customerId, string apiCode, int callCount);

        /// <summary>Credit a wallet from a confirmed Stripe top-up payment. Idempotent on
        /// stripePaymentIntentId so a replayed webhook does not double-credit.</summary>
        Task<ApiResponse<CreditBalanceDto>> ApplyTopUpAsync(
            int customerId, decimal amount, string stripePaymentIntentId, int? createdByUserId);

        /// <summary>Superadmin manual ± adjustment. Writes an AdminAdjustment ledger row.</summary>
        Task<ApiResponse<CreditBalanceDto>> AdminAdjustAsync(
            int customerId, decimal amount, string description, int adminUserId);

        /// <summary>Paged ledger for one customer, newest first.</summary>
        Task<ApiResponse<PagedCreditTransactionsDto>> GetTransactionsAsync(
            int customerId, int page, int pageSize);
    }
}
