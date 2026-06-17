using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Chat
{
    public interface IChatService
    {
        Task<ApiResponse<ChatMessageResponseDto>> SendMessageAsync(
            int userId,
            int customerId,
            ChatMessageRequestDto request,
            CancellationToken ct = default);

        Task<ApiResponse<ChatConversationDto>> GetConversationAsync(
            int userId,
            System.Guid conversationGuid,
            CancellationToken ct = default);

        Task<ApiResponse<System.Collections.Generic.List<ChatConversationSummaryDto>>> ListConversationsAsync(
            int userId,
            CancellationToken ct = default);

        Task<ApiResponse<bool>> DeleteConversationAsync(
            int userId,
            System.Guid conversationGuid,
            CancellationToken ct = default);
    }
}
