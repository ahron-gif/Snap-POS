using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;

namespace BackOffice.Application.Interfaces.Services.Chat
{
    public interface IChatTool
    {
        string Name { get; }
        string Description { get; }
        string PermissionKey { get; }
        bool IsActionTool { get; }
        string JsonSchema { get; }

        Task<ChatToolResult> ExecuteAsync(
            string argumentsJson,
            ChatToolContext context,
            CancellationToken ct);
    }

    public class ChatToolContext
    {
        public int UserId { get; set; }
        public int CustomerId { get; set; }
        public long? ConversationId { get; set; }
    }

    public class ChatToolResult
    {
        public bool IsSuccess { get; set; }
        public string ResultJson { get; set; } = "{}";
        public string? DraftGuid { get; set; }
        public string? Error { get; set; }
        public ChatVisualizationDto? Visualization { get; set; }
        public System.Collections.Generic.List<ChatEntityLinkDto>? Links { get; set; }

        public static ChatToolResult Ok(string resultJson) => new() { IsSuccess = true, ResultJson = resultJson };
        public static ChatToolResult Draft(string resultJson, string draftGuid) =>
            new() { IsSuccess = true, ResultJson = resultJson, DraftGuid = draftGuid };
        public static ChatToolResult Fail(string error) => new() { IsSuccess = false, Error = error, ResultJson = $"{{\"error\":\"{error}\"}}" };
        public static ChatToolResult OkWithChart(string resultJson, ChatVisualizationDto chart) =>
            new() { IsSuccess = true, ResultJson = resultJson, Visualization = chart };
        public static ChatToolResult OkWithLinks(string resultJson, System.Collections.Generic.List<ChatEntityLinkDto> links) =>
            new() { IsSuccess = true, ResultJson = resultJson, Links = links };
    }
}
