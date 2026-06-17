using System;

namespace BackOffice.Application.DTOs.Chat
{
    public class ChatMessageRequestDto
    {
        public Guid? ConversationGuid { get; set; }
        public string Content { get; set; } = string.Empty;
        public ChatPageContextDto? Context { get; set; }
    }

    public class ChatPageContextDto
    {
        public string? Route { get; set; }
        public string? EntityType { get; set; }
        public string? EntityId { get; set; }
        public string? EntityLabel { get; set; }
    }
}
