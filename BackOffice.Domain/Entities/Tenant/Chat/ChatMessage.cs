#nullable enable
using System;
using BackOffice.Domain.Attributes;
using BackOffice.Domain.Enums;

namespace BackOffice.Domain.Entities.Tenant.Chat
{
    [NotAudited]
    public partial class ChatMessage
    {
        public long Id { get; set; }

        public long ConversationId { get; set; }

        public ChatRole Role { get; set; }

        public string Content { get; set; } = null!;

        public string? ToolName { get; set; }

        public string? ToolCallId { get; set; }

        public string? ToolArgumentsJson { get; set; }

        public string? ToolResultJson { get; set; }

        public int InputTokens { get; set; }

        public int OutputTokens { get; set; }

        public string? ModelName { get; set; }

        public string? VisualizationsJson { get; set; }

        public string? LinksJson { get; set; }

        public string? SuggestedFollowUpsJson { get; set; }

        public DateTime CreatedAt { get; set; }

        public virtual ChatConversation Conversation { get; set; } = null!;
    }
}
