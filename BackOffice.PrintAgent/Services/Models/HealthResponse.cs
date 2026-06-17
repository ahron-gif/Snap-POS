namespace BackOffice.PrintAgent.Services.Models;

public class HealthResponse
{
    public string Status { get; set; } = "ok";
    public string Version { get; set; } = "0.0.0";
    public bool IsPaired { get; set; }
    public string? PairedOrigin { get; set; }
    public DateTimeOffset StartedAt { get; set; }
}
