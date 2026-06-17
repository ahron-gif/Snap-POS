namespace BackOffice.PrintAgent.Services.Models;

public class PairingInfo
{
    public string PairingId { get; set; } = string.Empty;
    public string Secret { get; set; } = string.Empty;
    public string? Origin { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? PairedAt { get; set; }
    public bool IsPaired => PairedAt.HasValue;
}
