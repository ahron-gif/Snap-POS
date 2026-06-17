using System;
using BackOffice.Domain.Enums;

namespace BackOffice.Application.DTOs.Chat
{
    public class ChatActionDraftDto
    {
        public Guid DraftGuid { get; set; }
        public string ToolName { get; set; } = string.Empty;
        public string PermissionKey { get; set; } = string.Empty;
        public string PreviewJson { get; set; } = string.Empty;
        public ChatDraftStatus Status { get; set; }
        public DateTime ExpiresAt { get; set; }
    }

    public class ChatDraftConfirmRequestDto
    {
        public string? Note { get; set; }
    }

    public class ChatDraftRejectRequestDto
    {
        public string? Reason { get; set; }
    }
}
