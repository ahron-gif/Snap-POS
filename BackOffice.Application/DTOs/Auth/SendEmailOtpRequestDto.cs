namespace BackOffice.Application.DTOs.Auth;

/// <summary>
/// Request body for POST /api/Mfa/email/send-otp.
/// Called without a full JWT — uses the MFA challenge token to identify the user.
/// </summary>
public class SendEmailOtpRequestDto
{
    /// <summary>The MFA challenge token from the login step.</summary>
    public string MfaToken { get; set; } = null!;
}
