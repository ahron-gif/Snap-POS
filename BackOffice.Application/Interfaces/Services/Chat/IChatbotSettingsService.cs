using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Chat
{
    public interface IChatbotSettingsService
    {
        Task<ChatbotSettingsDto> GetForTenantAsync(int customerId, CancellationToken ct = default);
        Task<ApiResponse<ChatbotSettingsDto>> UpdateAsync(int customerId, ChatbotSettingsDto dto, CancellationToken ct = default);
        Task<bool> IsWithinDailyCapAsync(int customerId, CancellationToken ct = default);
    }
}
