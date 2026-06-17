using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Chat
{
    public interface IToolRegistry
    {
        IReadOnlyList<IChatTool> All { get; }
        IChatTool? GetByName(string name);
        Task<IReadOnlyList<IChatTool>> GetAvailableForUserAsync(int userId, int customerId, CancellationToken ct = default);
    }
}
