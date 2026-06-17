using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant.Chat;
using BackOffice.Domain.Enums;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Chat
{
    public class ChatActionDraftService : IChatActionDraftService
    {
        private static readonly TimeSpan DraftTtl = TimeSpan.FromMinutes(15);

        private readonly TenantDBContext _tenantDb;
        private readonly IServiceProvider _serviceProvider;
        private readonly IRolePermissionChecker _permissionChecker;
        private readonly ILogger<ChatActionDraftService> _logger;

        public ChatActionDraftService(
            TenantDBContext tenantDb,
            IServiceProvider serviceProvider,
            IRolePermissionChecker permissionChecker,
            ILogger<ChatActionDraftService> logger)
        {
            _tenantDb = tenantDb;
            _serviceProvider = serviceProvider;
            _permissionChecker = permissionChecker;
            _logger = logger;
        }

        public async Task<ChatActionDraftDto> CreateDraftAsync(
            int userId,
            long? conversationId,
            string toolName,
            string permissionKey,
            string argumentsJson,
            string previewJson,
            CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            var entity = new ChatActionDraft
            {
                DraftGuid = Guid.NewGuid(),
                ConversationId = conversationId,
                UserId = userId,
                ToolName = toolName,
                PermissionKey = permissionKey,
                ArgumentsJson = argumentsJson,
                PreviewJson = previewJson,
                Status = ChatDraftStatus.Pending,
                CreatedAt = now,
                ExpiresAt = now.Add(DraftTtl)
            };

            await _tenantDb.Set<ChatActionDraft>().AddAsync(entity, ct);
            await _tenantDb.SaveChangesAsync(ct);

            return new ChatActionDraftDto
            {
                DraftGuid = entity.DraftGuid,
                ToolName = entity.ToolName,
                PermissionKey = entity.PermissionKey,
                PreviewJson = entity.PreviewJson,
                Status = entity.Status,
                ExpiresAt = entity.ExpiresAt
            };
        }

        public async Task<ApiResponse<object>> ConfirmAsync(Guid draftGuid, int userId, int customerId, string? note, CancellationToken ct)
        {
            var draft = await _tenantDb.Set<ChatActionDraft>()
                .FirstOrDefaultAsync(d => d.DraftGuid == draftGuid && d.UserId == userId, ct);

            if (draft == null)
                return ApiResponseFactory.NotFound<object>("Draft not found.");

            if (draft.Status != ChatDraftStatus.Pending)
                return ApiResponseFactory.BadRequest<object>($"Draft is already {draft.Status}.");

            if (draft.ExpiresAt < DateTime.UtcNow)
            {
                draft.Status = ChatDraftStatus.Expired;
                draft.ResolvedAt = DateTime.UtcNow;
                await _tenantDb.SaveChangesAsync(ct);
                return ApiResponseFactory.BadRequest<object>("Draft has expired.");
            }

            var (module, action) = SplitPermissionKey(draft.PermissionKey);
            var allowed = await _permissionChecker.UserHasPermissionAsync(userId, customerId, module, action);
            if (!allowed)
                return ApiResponseFactory.Forbidden<object>("You no longer have permission to execute this action.");

            var toolRegistry = _serviceProvider.GetRequiredService<IToolRegistry>();
            var tool = toolRegistry.GetByName(draft.ToolName);
            if (tool == null)
                return ApiResponseFactory.BadRequest<object>("Tool is no longer registered.");

            try
            {
                var ctx = new ChatToolContext
                {
                    UserId = userId,
                    CustomerId = customerId,
                    ConversationId = draft.ConversationId
                };

                var executionArgs = System.Text.Json.JsonSerializer.Serialize(new
                {
                    confirm = true,
                    draftGuid = draft.DraftGuid,
                    args = System.Text.Json.JsonDocument.Parse(draft.ArgumentsJson).RootElement
                });

                var result = await tool.ExecuteAsync(executionArgs, ctx, ct);

                draft.Status = result.IsSuccess ? ChatDraftStatus.Confirmed : ChatDraftStatus.Pending;
                draft.ResolvedAt = DateTime.UtcNow;
                draft.ResolutionNote = note;
                await _tenantDb.SaveChangesAsync(ct);

                if (!result.IsSuccess)
                    return ApiResponseFactory.InternalError<object>(result.Error ?? "Execution failed.");

                return ApiResponseFactory.Success<object>(new { resultJson = result.ResultJson });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to confirm draft {DraftGuid}", draftGuid);
                return ApiResponseFactory.InternalError<object>("Draft execution failed.");
            }
        }

        public async Task<ApiResponse<bool>> RejectAsync(Guid draftGuid, int userId, string? reason, CancellationToken ct)
        {
            var draft = await _tenantDb.Set<ChatActionDraft>()
                .FirstOrDefaultAsync(d => d.DraftGuid == draftGuid && d.UserId == userId, ct);

            if (draft == null)
                return ApiResponseFactory.NotFound<bool>("Draft not found.");

            if (draft.Status != ChatDraftStatus.Pending)
                return ApiResponseFactory.BadRequest<bool>($"Draft is already {draft.Status}.");

            draft.Status = ChatDraftStatus.Rejected;
            draft.ResolvedAt = DateTime.UtcNow;
            draft.ResolutionNote = reason;
            await _tenantDb.SaveChangesAsync(ct);

            return ApiResponseFactory.Success(true);
        }

        private static (string module, string action) SplitPermissionKey(string permissionKey)
        {
            var idx = permissionKey.IndexOf(':');
            if (idx < 0) return ("chatbot", permissionKey);
            return (permissionKey.Substring(0, idx), permissionKey.Substring(idx + 1));
        }
    }
}
