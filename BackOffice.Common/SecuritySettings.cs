namespace BackOffice.Common;

public class SecuritySettings
{
    public const string SectionName = "SecuritySettings";

    public string ResetPasswordTokenKey { get; set; } = null!;
    public int TokenExpiryMinutes { get; set; } = 30;

    /// <summary>AES-256 encryption key for TOTP secrets. Must be exactly 32 ASCII characters.</summary>
    public string MfaEncryptionKey { get; set; } = null!;

    /// <summary>Expiry in minutes for the MFA challenge token issued after password auth (default: 5).</summary>
    public int MfaChallengeExpiryMinutes { get; set; } = 5;

    /// <summary>Expiry in minutes for email OTP codes (default: 5).</summary>
    public int EmailOtpExpiryMinutes { get; set; } = 5;

    /// <summary>Maximum failed MFA attempts before lockout (default: 5).</summary>
    public int MaxMfaAttempts { get; set; } = 5;
}
