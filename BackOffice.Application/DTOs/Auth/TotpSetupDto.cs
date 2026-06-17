namespace BackOffice.Application.DTOs.Auth;

/// <summary>
/// Returned by POST /api/Mfa/totp/setup.
/// Display the QR code to the user and let them scan it with their authenticator app.
/// The secret is also shown in plain text for manual entry.
/// </summary>
public class TotpSetupDto
{
    /// <summary>Base32-encoded TOTP secret for manual entry into authenticator app.</summary>
    public string Secret { get; set; } = null!;

    /// <summary>otpauth:// URI — used to generate the QR code on the frontend if preferred.</summary>
    public string QrCodeUri { get; set; } = null!;

    /// <summary>Base64-encoded PNG QR code image (data:image/png;base64,...) ready for &lt;img src=&gt;.</summary>
    public string QrCodeBase64 { get; set; } = null!;
}
