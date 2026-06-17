using BackOffice.Application.DTOs.Auth;

namespace BackOffice.Application.Interfaces.Services.Main;

public interface IMfaService
{
    // ── Status ─────────────────────────────────────────────────────────────────
    Task<MfaStatusDto> GetStatusAsync(int userId);

    // ── TOTP Setup ─────────────────────────────────────────────────────────────
    /// <summary>Generate a new TOTP secret + QR code for the user. Secret is saved but NOT activated until ConfirmTotpSetupAsync succeeds.</summary>
    Task<TotpSetupDto> GenerateTotpSetupAsync(int userId, string email);

    /// <summary>Verify the 6-digit TOTP code to confirm the setup. Activates MFA on success.</summary>
    Task<bool> ConfirmTotpSetupAsync(int userId, string code);

    /// <summary>Disable TOTP (preserves the stored secret for potential reactivation).</summary>
    Task<bool> DisableTotpAsync(int userId);

    /// <summary>Re-enable MFA using the existing TOTP secret. Verifies a code first. Returns false if invalid.</summary>
    Task<bool> ReactivateTotpAsync(int userId, string code);

    /// <summary>Generate a fresh TOTP secret (discards the old one) and return setup info.</summary>
    Task<TotpSetupDto> ResetTotpSetupAsync(int userId, string email);

    // ── Email OTP ──────────────────────────────────────────────────────────────
    /// <summary>Generate a 6-digit OTP, store its hash, and email it to the user.</summary>
    Task<bool> SendEmailOtpAsync(int userId, string email);

    // ── Challenge (Login Step 2) ────────────────────────────────────────────────
    /// <summary>Create a short-lived MFA challenge token after successful password auth. Returns the raw token.</summary>
    Task<string> CreateChallengeAsync(int userId, string method);

    /// <summary>Validate the MFA code against the challenge. Returns true on success.</summary>
    Task<bool> VerifyChallengeAsync(int userId, string rawToken, string code, string method, string ipAddress);

    // ── Rate Limiting ──────────────────────────────────────────────────────────
    /// <summary>Returns true if the user has exceeded MaxMfaAttempts in the last 15 minutes.</summary>
    Task<bool> IsLockedOutAsync(int userId, string attemptType);

    // ── Recovery Codes ─────────────────────────────────────────────────────────
    /// <summary>Returns remaining recovery codes count (not the actual codes — those are hashed).</summary>
    Task<int> GetRemainingRecoveryCodesCountAsync(int userId);

    /// <summary>Generate 8 new recovery codes. Old codes are invalidated. Returns plaintext codes (show once).</summary>
    Task<RecoveryCodesDto> RegenerateRecoveryCodesAsync(int userId);

    // ── Trusted Devices ──────────────────────────────────────────────────────
    /// <summary>Check if the given raw device token is a valid trusted device for the user.</summary>
    Task<bool> IsTrustedDeviceAsync(int userId, string rawToken);

    /// <summary>Create a trusted device record and return the raw token (to be set as HttpOnly cookie).</summary>
    Task<string> CreateTrustedDeviceAsync(int userId, string deviceInfo, string ipAddress, bool force30Day);

    /// <summary>Revoke all trusted devices for the user (e.g., when MFA is disabled).</summary>
    Task RevokeAllTrustedDevicesAsync(int userId);

    // ── Preferred Method ──────────────────────────────────────────────────────
    /// <summary>Set the user's preferred MFA method ("totp" or "email").</summary>
    Task SetPreferredMethodAsync(int userId, string method);

    /// <summary>Get the user's preferred MFA method. Returns null for auto-detect.</summary>
    Task<string?> GetPreferredMethodAsync(int userId);

    // ── Cleanup ────────────────────────────────────────────────────────────────
    /// <summary>Delete expired challenges, OTP codes, old audit logs, and expired trusted devices.</summary>
    Task CleanupExpiredAsync();
}
