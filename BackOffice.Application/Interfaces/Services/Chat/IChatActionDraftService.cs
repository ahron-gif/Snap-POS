using System;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Chat
{
    public interface IChatActionDraftService
    {
        Task<ChatActionDraftDto> CreateDraftAsync(
            int userId,
            long? conversationId,
            string toolName,
            string permissionKey,
            string argumentsJson,
            string previewJson,
            CancellationToken ct);

        Task<ApiResponse<object>> ConfirmAsync(Guid draftGuid, int userId, int customerId, string? note, CancellationToken ct);

        Task<ApiResponse<bool>> RejectAsync(Guid draftGuid, int userId, string? reason, CancellationToken ct);
    }
}
