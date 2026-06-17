#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public class MfaTrustedDevice
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string DeviceTokenHash { get; set; } = null!;  // SHA-256 of raw cookie token
    public string? DeviceInfo { get; set; }                // User-Agent
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }               // NULL = never expires
    public bool IsRevoked { get; set; }
}
