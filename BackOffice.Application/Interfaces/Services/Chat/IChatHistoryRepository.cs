using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Domain.Entities.Tenant.Chat;

namespace BackOffice.Application.Interfaces.Services.Chat
{
    public interface IChatHistoryRepository
    {
        Task<ChatConversation> GetOrCreateConversationAsync(Guid conversationGuid, int userId, string title, CancellationToken ct);
        Task<ChatConversation?> GetByGuidAsync(Guid conversationGuid, int userId, CancellationToken ct);
        Task<List<ChatConversation>> ListForUserAsync(int userId, int limit, CancellationToken ct);
        Task<List<ChatMessage>> GetRecentMessagesAsync(long conversationId, int limit, CancellationToken ct);
        Task AddMessageAsync(ChatMessage message, CancellationToken ct);
        Task SoftDeleteAsync(Guid conversationGuid, int userId, CancellationToken ct);
        Task UpdateConversationStatsAsync(long conversationId, int inputTokens, int outputTokens, CancellationToken ct);
    }
}
