namespace BackOffice.Application.DTOs.Auth;

/// <summary>
/// Returned by POST /api/Auth/login when the user has MFA enabled.
/// The client must proceed to POST /api/Auth/verify-mfa.
/// </summary>
public class MfaRequiredResponseDto
{
    public bool MfaRequired { get; set; } = true;

    /// <summary>Short-lived token (5 min) linking this session challenge to the user.</summary>
    public string MfaToken { get; set; } = null!;

    /// <summary>"totp" | "email" — the preferred method to show first on the OTP screen.</summary>
    public string PreferredMethod { get; set; } = null!;

    /// <summary>When true, the "Remember device" checkbox label should say "for 30 days".</summary>
    public bool Force30DayReauth { get; set; }

    /// <summary>Whether the user has a TOTP authenticator app set up. Used to conditionally show the authenticator option on the login MFA screen.</summary>
    public bool IsTotpSetup { get; set; }
}
