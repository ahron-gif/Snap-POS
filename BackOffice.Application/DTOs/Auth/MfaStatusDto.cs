namespace BackOffice.Application.DTOs.Auth;

/// <summary>
/// Returned by GET /api/Mfa/status — shows the current MFA configuration for the user.
/// </summary>
public class MfaStatusDto
{
    public bool IsMfaEnabled { get; set; }
    public bool IsTotpSetup { get; set; }
    public bool IsEmailOtpEnabled { get; set; }
    public string? PreferredMfaMethod { get; set; }
    /// <summary>True if the user has a stored TOTP secret (even if MFA is currently disabled).</summary>
    public bool HasTotpSecret { get; set; }
}
