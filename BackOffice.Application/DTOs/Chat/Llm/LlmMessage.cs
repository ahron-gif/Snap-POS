using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Chat.Llm
{
    public class LlmMessage
    {
        public string Role { get; set; } = "user";
        public string? Content { get; set; }
        public List<LlmToolCall>? ToolCalls { get; set; }
        public string? ToolCallId { get; set; }
        public string? ToolResult { get; set; }
    }

    public class LlmToolCall
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string ArgumentsJson { get; set; } = "{}";
    }

    public class LlmToolSchema
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string JsonSchema { get; set; } = "{}";
    }

    public class LlmCompletionRequest
    {
        public string SystemPrompt { get; set; } = string.Empty;
        public List<LlmMessage> Messages { get; set; } = new();
        public List<LlmToolSchema> Tools { get; set; } = new();
        public int MaxTokens { get; set; } = 800;
        public bool EnablePromptCaching { get; set; } = true;
    }

    public class LlmCompletionResponse
    {
        public string? TextContent { get; set; }
        public List<LlmToolCall> ToolCalls { get; set; } = new();
        public int InputTokens { get; set; }
        public int OutputTokens { get; set; }
        public string ModelName { get; set; } = string.Empty;
        public string StopReason { get; set; } = string.Empty;
    }
}
