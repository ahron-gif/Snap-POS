using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IUsageTrackingService
    {
        Task<ApiResponse<CustomerUsageDashboardDto>> GetCustomerUsageAsync(int customerId);
        Task<ApiResponse<bool>> RecordUsageAsync(RecordUsageDto dto);
        Task<ApiResponse<bool>> RecordApiCallAsync(RecordApiCallDto dto);
        Task<ApiResponse<bool>> CheckLimitAsync(int customerId, string metricType);

        // Per-device registration & heartbeat. Idempotent on (CustomerId, AppId, AdvancedUId).
        // New devices claim a free CustomerAppLicense slot; if none free, returns Allowed=false.
        Task<ApiResponse<RegisterDeviceResultDto>> RegisterDeviceAsync(int customerId, RegisterDeviceDto dto);

        // Read-only check — used by dashboards and admin tooling. Does not create a CustomerDevice row.
        Task<ApiResponse<DeviceLimitDto>> CheckDeviceLimitAsync(int customerId, int appId);

        // Returns slot/device counts for every app the customer has any licenses or pricing for.
        // Used by the Licenses & Billing dashboard to show "X of Y devices active" per app row.
        Task<ApiResponse<List<DeviceLimitDto>>> GetAllDeviceLimitsAsync(int customerId);

        // Per-user Web App seat check — called from AuthController.Login before
        // session creation. Counts active sessions vs allocated Web App licenses;
        // a user who already holds a session is always allowed (re-login).
        // Returns Allowed=true if no Web App licenses are configured (== unlimited).
        Task<ApiResponse<WebAppSeatCheckDto>> CheckWebAppSeatAsync(int customerId, int userId);

        Task<ApiResponse<WebAppUserLimitDto>> CheckWebAppUserLimitAsync(int customerId);

        /// <summary>
        /// Returns per-day transaction records for the customer's current billing cycle,
        /// joined with the plan's free-tier so each row knows free vs billable counts and amount.
        /// Used by the Licenses & Billing page "Transactions" panel to render a row-per-day
        /// list under the existing summary cards.
        /// </summary>
        Task<ApiResponse<List<TransactionRecordDto>>> GetTransactionDetailsAsync(int customerId);
    }
}
