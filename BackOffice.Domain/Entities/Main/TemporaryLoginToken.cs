#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public class TemporaryLoginToken
{
    public Guid TokenId { get; set; }

    public int UserId { get; set; }

    public int? CustomerId { get; set; }

    public string TokenHash { get; set; } = null!;

    public string? DeviceInfo { get; set; }

    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    public bool IsUsed { get; set; }

    public string ConflictType { get; set; } = null!;

    public Guid? ExistingSessionId { get; set; }
}
