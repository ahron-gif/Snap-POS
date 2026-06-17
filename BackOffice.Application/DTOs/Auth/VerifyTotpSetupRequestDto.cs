namespace BackOffice.Application.DTOs.Auth;

/// <summary>
/// Request body for POST /api/Mfa/totp/verify-setup.
/// User enters the 6-digit code from their authenticator app to confirm setup.
/// </summary>
public class VerifyTotpSetupRequestDto
{
    public string Code { get; set; } = null!;
}
