#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public class UserMfaSetting
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public bool IsMfaEnabled { get; set; }
    public string? TotpSecretEncrypted { get; set; }  // AES-256 encrypted, Base64 (IV prepended)
    public bool IsTotpSetup { get; set; }
    public bool IsEmailOtpEnabled { get; set; }
    public string? RecoveryCodes { get; set; }         // JSON array of BCrypt hashes
    public string? PreferredMfaMethod { get; set; }   // "totp" | "email" | null (auto-detect)
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
