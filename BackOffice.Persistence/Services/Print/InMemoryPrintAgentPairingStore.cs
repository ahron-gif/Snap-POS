using System.Collections.Concurrent;
using BackOffice.Application.Interfaces.Services.Print;

namespace BackOffice.Persistence.Services.Print
{
    public class InMemoryPrintAgentPairingStore : IPrintAgentPairingStore
    {
        private readonly ConcurrentDictionary<Guid, StoredPairing> _pairings = new();

        public StoredPairing? Get(Guid userId) => _pairings.TryGetValue(userId, out var p) ? p : null;

        public void Save(StoredPairing pairing) => _pairings[pairing.UserId] = pairing;

        public void Remove(Guid userId) => _pairings.TryRemove(userId, out _);
    }
}
