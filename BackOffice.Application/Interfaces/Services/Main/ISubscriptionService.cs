using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface ISubscriptionService
    {
        Task<ApiResponse<CustomerSubscriptionDetailDto>> GetCurrentSubscriptionAsync(int customerId);
        Task<ApiResponse<bool>> ChangeSubscriptionAsync(ChangeSubscriptionDto dto, int changedBy);
        Task<ApiResponse<bool>> ApplyAppOverrideAsync(CustomerAppOverrideDto dto);
        Task<ApiResponse<bool>> ApplyApiOverrideAsync(CustomerApiOverrideDto dto);
        Task<ApiResponse<bool>> SuspendCustomerAsync(int customerId, string reason);
        Task<ApiResponse<bool>> ReactivateCustomerAsync(int customerId);
        Task<ApiResponse<List<SubscriptionHistoryDto>>> GetSubscriptionHistoryAsync(int customerId);
    }
}
