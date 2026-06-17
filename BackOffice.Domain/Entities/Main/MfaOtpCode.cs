#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public class MfaOtpCode
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string CodeHash { get; set; } = null!;  // SHA-256 of the 6-digit code
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
    public int AttemptCount { get; set; }
}
