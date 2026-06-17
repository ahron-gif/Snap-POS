using System;
using System.Collections.Generic;
using BackOffice.Domain.Enums;

namespace BackOffice.Application.DTOs.Chat
{
    public class ChatConversationSummaryDto
    {
        public Guid ConversationGuid { get; set; }
        public string Title { get; set; } = string.Empty;
        public int TotalMessages { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class ChatConversationDto
    {
        public Guid ConversationGuid { get; set; }
        public string Title { get; set; } = string.Empty;
        public List<ChatHistoryMessageDto> Messages { get; set; } = new();
    }

    public class ChatHistoryMessageDto
    {
        public ChatRole Role { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? ToolName { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<ChatVisualizationDto>? Visualizations { get; set; }
        public List<ChatEntityLinkDto>? Links { get; set; }
        public List<string>? SuggestedFollowUps { get; set; }
    }
}
