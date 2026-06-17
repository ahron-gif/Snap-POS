using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.Extensions.Logging;

namespace BackOffice.Application.Services.Chat
{
    public class ToolExecutor : IToolExecutor
    {
        private readonly IToolRegistry _registry;
        private readonly IRolePermissionChecker _permissionChecker;
        private readonly ILogger<ToolExecutor> _logger;

        public ToolExecutor(
            IToolRegistry registry,
            IRolePermissionChecker permissionChecker,
            ILogger<ToolExecutor> logger)
        {
            _registry = registry;
            _permissionChecker = permissionChecker;
            _logger = logger;
        }

        public async Task<ChatToolResult> ExecuteAsync(
            string toolName,
            string argumentsJson,
            ChatToolContext context,
            CancellationToken ct = default)
        {
            var tool = _registry.GetByName(toolName);
            if (tool == null)
            {
                _logger.LogWarning("Unknown tool requested: {ToolName} by user {UserId}", toolName, context.UserId);
                return ChatToolResult.Fail($"Unknown tool '{toolName}'");
            }

            var (module, action) = SplitPermissionKey(tool.PermissionKey);
            var allowed = await _permissionChecker.UserHasPermissionAsync(
                context.UserId, context.CustomerId, module, action);

            if (!allowed)
            {
                _logger.LogWarning(
                    "Tool {Tool} denied for user {UserId} tenant {CustomerId} (permission {Key})",
                    toolName, context.UserId, context.CustomerId, tool.PermissionKey);
                return ChatToolResult.Fail("You do not have permission to use this tool.");
            }

            try
            {
                var result = await tool.ExecuteAsync(argumentsJson ?? "{}", context, ct);
                _logger.LogInformation(
                    "Tool {Tool} executed for user {UserId}. Success={Success}",
                    toolName, context.UserId, result.IsSuccess);
                return result;
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Tool {Tool} threw for user {UserId}", toolName, context.UserId);
                return ChatToolResult.Fail("Tool execution failed.");
            }
        }

        private static (string module, string action) SplitPermissionKey(string permissionKey)
        {
            var idx = permissionKey.IndexOf(':');
            if (idx < 0) return ("chatbot", permissionKey);
            return (permissionKey.Substring(0, idx), permissionKey.Substring(idx + 1));
        }
    }
}
