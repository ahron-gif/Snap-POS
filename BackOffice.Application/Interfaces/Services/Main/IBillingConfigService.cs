using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IBillingConfigService
    {
        Task<ApiResponse<List<BillingConfigDto>>> GetAllConfigsAsync();
        Task<ApiResponse<bool>> UpdateConfigAsync(UpdateBillingConfigDto dto, int updatedBy);
        Task<ApiResponse<string?>> GetConfigValueAsync(string key);
    }
}
