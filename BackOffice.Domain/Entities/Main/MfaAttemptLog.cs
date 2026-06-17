#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public class MfaAttemptLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string AttemptType { get; set; } = null!;  // "totp" | "email_otp" | "recovery" | "setup"
    public bool IsSuccess { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
}
