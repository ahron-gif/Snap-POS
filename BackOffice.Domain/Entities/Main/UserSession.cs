#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public class UserSession
{
    public Guid SessionId { get; set; }

    public int UserId { get; set; }

    public int? CustomerId { get; set; }

    public string? DeviceInfo { get; set; }

    public string? IpAddress { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime LastActivityAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public string? RevokedReason { get; set; }

    public string? RefreshTokenHash { get; set; }

    public DateTime? RefreshTokenExpiresAt { get; set; }
}
