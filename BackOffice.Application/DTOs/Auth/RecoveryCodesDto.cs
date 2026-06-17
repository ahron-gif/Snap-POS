namespace BackOffice.Application.DTOs.Auth;

/// <summary>
/// Returned by POST /api/Mfa/recovery-codes/regenerate.
/// Plaintext recovery codes — shown only once. The user must save them immediately.
/// </summary>
public class RecoveryCodesDto
{
    /// <summary>8 plaintext recovery codes. Each can be used once to bypass MFA.</summary>
    public List<string> Codes { get; set; } = new();
}
