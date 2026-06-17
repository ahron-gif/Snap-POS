using System.Collections.Generic;
using BackOffice.Application.DTOs.Chat;

namespace BackOffice.Application.Interfaces.Services.Chat
{
    public interface IPromptBuilder
    {
        string BuildSystemPrompt(int userId, int customerId, string? tenantName, ChatPageContextDto? pageContext = null);
        List<BackOffice.Application.DTOs.Chat.Llm.LlmToolSchema> BuildToolSchemas(IReadOnlyList<IChatTool> tools);
    }
}
