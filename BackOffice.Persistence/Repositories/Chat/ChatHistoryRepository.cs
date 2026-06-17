using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Domain.Entities.Tenant.Chat;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Repositories.Chat
{
    public class ChatHistoryRepository : IChatHistoryRepository
    {
        private readonly TenantDBContext _db;

        public ChatHistoryRepository(TenantDBContext db) { _db = db; }

        public async Task<ChatConversation> GetOrCreateConversationAsync(
            Guid conversationGuid, int userId, string title, CancellationToken ct)
        {
            var existing = await _db.Set<ChatConversation>()
                .FirstOrDefaultAsync(c => c.ConversationGuid == conversationGuid && c.UserId == userId && !c.IsDeleted, ct);

            if (existing != null) return existing;

            var now = DateTime.UtcNow;
            var entity = new ChatConversation
            {
                ConversationGuid = conversationGuid,
                UserId = userId,
                Title = title,
                CreatedAt = now,
                UpdatedAt = now
            };
            await _db.Set<ChatConversation>().AddAsync(entity, ct);
            await _db.SaveChangesAsync(ct);
            return entity;
        }

        public async Task<ChatConversation?> GetByGuidAsync(Guid conversationGuid, int userId, CancellationToken ct)
        {
            return await _db.Set<ChatConversation>()
                .FirstOrDefaultAsync(c => c.ConversationGuid == conversationGuid && c.UserId == userId && !c.IsDeleted, ct);
        }

        public async Task<List<ChatConversation>> ListForUserAsync(int userId, int limit, CancellationToken ct)
        {
            return await _db.Set<ChatConversation>()
                .AsNoTracking()
                .Where(c => c.UserId == userId && !c.IsDeleted)
                .OrderByDescending(c => c.UpdatedAt)
                .Take(limit)
                .ToListAsync(ct);
        }

        public async Task<List<ChatMessage>> GetRecentMessagesAsync(long conversationId, int limit, CancellationToken ct)
        {
            var msgs = await _db.Set<ChatMessage>()
                .AsNoTracking()
                .Where(m => m.ConversationId == conversationId)
                .OrderByDescending(m => m.CreatedAt)
                .Take(limit)
                .ToListAsync(ct);
            return msgs;
        }

        public async Task AddMessageAsync(ChatMessage message, CancellationToken ct)
        {
            try
            {
                await _db.Set<ChatMessage>().AddAsync(message, ct);
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {

                throw ex;
            }
        }

        public async Task SoftDeleteAsync(Guid conversationGuid, int userId, CancellationToken ct)
        {
            var convo = await _db.Set<ChatConversation>()
                .FirstOrDefaultAsync(c => c.ConversationGuid == conversationGuid && c.UserId == userId, ct);
            if (convo == null) return;
            convo.IsDeleted = true;
            convo.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        public async Task UpdateConversationStatsAsync(long conversationId, int inputTokens, int outputTokens, CancellationToken ct)
        {
            var convo = await _db.Set<ChatConversation>().FirstOrDefaultAsync(c => c.Id == conversationId, ct);
            if (convo == null) return;
            convo.TotalMessages += 1;
            convo.TotalInputTokens += inputTokens;
            convo.TotalOutputTokens += outputTokens;
            convo.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
    }
}
