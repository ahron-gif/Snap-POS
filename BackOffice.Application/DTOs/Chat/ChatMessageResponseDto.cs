using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Chat
{
    public class ChatMessageResponseDto
    {
        public Guid ConversationGuid { get; set; }
        public string AssistantReply { get; set; } = string.Empty;
        public List<ChatToolInvocationDto> ToolsInvoked { get; set; } = new();
        public List<ChatActionDraftDto> PendingDrafts { get; set; } = new();
        public List<ChatVisualizationDto> Visualizations { get; set; } = new();
        public List<ChatEntityLinkDto> Links { get; set; } = new();
        public List<string> SuggestedFollowUps { get; set; } = new();
        public int InputTokens { get; set; }
        public int OutputTokens { get; set; }
        public string? ModelName { get; set; }
    }

    public class ChatToolInvocationDto
    {
        public string ToolName { get; set; } = string.Empty;
        public string? ArgumentsJson { get; set; }
        public string? ResultSummary { get; set; }
    }
}
