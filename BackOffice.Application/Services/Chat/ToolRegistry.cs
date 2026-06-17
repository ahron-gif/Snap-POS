using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Application.Interfaces.Services.Main;

namespace BackOffice.Application.Services.Chat
{
    public class ToolRegistry : IToolRegistry
    {
        private readonly IReadOnlyList<IChatTool> _tools;
        private readonly Dictionary<string, IChatTool> _byName;
        private readonly IRolePermissionChecker _permissionChecker;

        public ToolRegistry(IEnumerable<IChatTool> tools, IRolePermissionChecker permissionChecker)
        {
            _tools = tools.ToList();
            _byName = _tools.ToDictionary(t => t.Name, System.StringComparer.OrdinalIgnoreCase);
            _permissionChecker = permissionChecker;
        }

        public IReadOnlyList<IChatTool> All => _tools;

        public IChatTool? GetByName(string name)
        {
            return _byName.TryGetValue(name, out var tool) ? tool : null;
        }

        public async Task<IReadOnlyList<IChatTool>> GetAvailableForUserAsync(int userId, int customerId, CancellationToken ct = default)
        {
            var results = new List<IChatTool>(_tools.Count);
            foreach (var tool in _tools)
            {
                var (module, action) = SplitPermissionKey(tool.PermissionKey);
                var allowed = await _permissionChecker.UserHasPermissionAsync(userId, customerId, module, action);
                if (allowed)
                {
                    results.Add(tool);
                }
            }
            return results;
        }

        private static (string module, string action) SplitPermissionKey(string permissionKey)
        {
            var idx = permissionKey.IndexOf(':');
            if (idx < 0)
            {
                return ("chatbot", permissionKey);
            }
            return (permissionKey.Substring(0, idx), permissionKey.Substring(idx + 1));
        }
    }
}
