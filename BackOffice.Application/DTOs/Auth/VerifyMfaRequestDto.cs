namespace BackOffice.Application.DTOs.Auth;

/// <summary>
/// Request body for POST /api/Auth/verify-mfa (step 2 of MFA login).
/// </summary>
public class VerifyMfaRequestDto
{
    /// <summary>The MFA challenge token returned from the login step.</summary>
    public string MfaToken { get; set; } = null!;

    /// <summary>The OTP code entered by the user (6-digit TOTP, email OTP, or recovery code).</summary>
    public string Code { get; set; } = null!;

    /// <summary>"totp" | "email" | "recovery"</summary>
    public string Method { get; set; } = null!;

    /// <summary>When true, the server issues a trusted-device HttpOnly cookie to skip MFA on future logins.</summary>
    public bool RememberDevice { get; set; }
}
