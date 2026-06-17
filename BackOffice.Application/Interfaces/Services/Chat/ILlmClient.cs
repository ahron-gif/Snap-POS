using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat.Llm;

namespace BackOffice.Application.Interfaces.Services.Chat
{
    public interface ILlmClient
    {
        Task<LlmCompletionResponse> CompleteAsync(LlmCompletionRequest request, CancellationToken ct = default);
    }
}
