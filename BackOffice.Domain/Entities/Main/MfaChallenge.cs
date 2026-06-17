#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public class MfaChallenge
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string ChallengeTokenHash { get; set; } = null!;  // SHA-256 of the raw token sent to client
    public string MfaMethod { get; set; } = null!;            // "totp" | "email" | "recovery"
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
}
