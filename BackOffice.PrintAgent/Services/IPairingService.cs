using BackOffice.PrintAgent.Services.Models;

namespace BackOffice.PrintAgent.Services;

public interface IPairingService
{
    PairingInfo GetOrCreate();
    PairingInfo Current { get; }
    void CompletePairing(string origin);
    void Reset();
    bool IsPaired { get; }
}
