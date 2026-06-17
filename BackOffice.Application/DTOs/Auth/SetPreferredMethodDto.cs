namespace BackOffice.Application.DTOs.Auth;

/// <summary>
/// Request body for POST /api/Mfa/preferred-method.
/// </summary>
public class SetPreferredMethodDto
{
    /// <summary>"totp" | "email"</summary>
    public string Method { get; set; } = null!;
}
