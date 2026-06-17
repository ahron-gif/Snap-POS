using System.Threading;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Chat
{
    public interface IToolExecutor
    {
        Task<ChatToolResult> ExecuteAsync(
            string toolName,
            string argumentsJson,
            ChatToolContext context,
            CancellationToken ct = default);
    }
}
