#nullable enable
using System;
using BackOffice.Domain.Attributes;
using BackOffice.Domain.Enums;

namespace BackOffice.Domain.Entities.Tenant.Chat
{
    [NotAudited]
    public partial class ChatActionDraft
    {
        public long Id { get; set; }

        public Guid DraftGuid { get; set; }

        public long? ConversationId { get; set; }

        public int UserId { get; set; }

        public string ToolName { get; set; } = null!;

        public string PermissionKey { get; set; } = null!;

        public string ArgumentsJson { get; set; } = null!;

        public string PreviewJson { get; set; } = null!;

        public ChatDraftStatus Status { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime ExpiresAt { get; set; }

        public DateTime? ResolvedAt { get; set; }

        public string? ResolutionNote { get; set; }
    }
}
