using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.Interfaces.Services.Chat;

namespace BackOffice.Application.Services.Chat.Tools
{
    public abstract class ChatToolBase : IChatTool
    {
        public abstract string Name { get; }
        public abstract string Description { get; }
        public abstract string PermissionKey { get; }
        public virtual bool IsActionTool => false;
        public abstract string JsonSchema { get; }

        public abstract Task<ChatToolResult> ExecuteAsync(
            string argumentsJson,
            ChatToolContext context,
            CancellationToken ct);
    }
}
