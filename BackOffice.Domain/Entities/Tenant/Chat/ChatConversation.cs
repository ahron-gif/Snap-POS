#nullable enable
using System;
using System.Collections.Generic;
using BackOffice.Domain.Attributes;

namespace BackOffice.Domain.Entities.Tenant.Chat
{
    [NotAudited]
    public partial class ChatConversation
    {
        public long Id { get; set; }

        public Guid ConversationGuid { get; set; }

        public int UserId { get; set; }

        public string Title { get; set; } = null!;

        public string? SummaryText { get; set; }

        public int TotalMessages { get; set; }

        public long TotalInputTokens { get; set; }

        public long TotalOutputTokens { get; set; }

        public bool IsDeleted { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public virtual ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
    }
}
