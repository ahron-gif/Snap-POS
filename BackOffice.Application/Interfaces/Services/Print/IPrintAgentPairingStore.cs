namespace BackOffice.Application.Interfaces.Services.Print
{
    public class StoredPairing
    {
        public Guid UserId { get; set; }
        public string PairingId { get; set; } = string.Empty;
        public string Secret { get; set; } = string.Empty;
        public string Origin { get; set; } = string.Empty;
        public DateTimeOffset PairedAt { get; set; }
    }

    public interface IPrintAgentPairingStore
    {
        StoredPairing? Get(Guid userId);
        void Save(StoredPairing pairing);
        void Remove(Guid userId);
    }
}
