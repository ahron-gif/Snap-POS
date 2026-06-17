using BackOffice.Application.DTOs.Auth;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Persistence.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using Newtonsoft.Json;
using OtpNet;
using QRCoder;
using System.Security.Cryptography;
using System.Text;

namespace BackOffice.Persistence.Services.Main;

public class MfaService : IMfaService
{
    private readonly MainDBContext _db;
    private readonly SecuritySettings _settings;
    private readonly ILogger<MfaService> _logger;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;
    private readonly ISmtpSettingsResolver _smtpResolver;

    public MfaService(
        MainDBContext db,
        IOptions<SecuritySettings> settings,
        ILogger<MfaService> logger,
        Microsoft.Extensions.Configuration.IConfiguration configuration,
        ISmtpSettingsResolver smtpResolver)
    {
        _db = db;
        _settings = settings.Value;
        _logger = logger;
        _configuration = configuration;
        _smtpResolver = smtpResolver;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Status
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<MfaStatusDto> GetStatusAsync(int userId)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        if (setting == null)
            return new MfaStatusDto();

        return new MfaStatusDto
        {
            IsMfaEnabled = setting.IsMfaEnabled,
            IsTotpSetup = setting.IsTotpSetup,
            IsEmailOtpEnabled = setting.IsEmailOtpEnabled,
            PreferredMfaMethod = setting.PreferredMfaMethod,
            HasTotpSecret = !string.IsNullOrEmpty(setting.TotpSecretEncrypted)
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TOTP Setup
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<TotpSetupDto> GenerateTotpSetupAsync(int userId, string email)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);

        byte[] secretBytes;
        if (setting?.TotpSecretEncrypted != null)
        {
            secretBytes = AesDecrypt(setting.TotpSecretEncrypted);
        }
        else
        {
            secretBytes = RandomNumberGenerator.GetBytes(20);
        }

        var base32Secret = Base32Encoding.ToString(secretBytes);

        // Build the otpauth:// URI for QR code scanning
        var issuer = Uri.EscapeDataString("RDT System");
        var accountName = Uri.EscapeDataString(email);
        var otpUri = $"otpauth://totp/{issuer}:{accountName}?secret={base32Secret}&issuer={issuer}&digits=6&period=30";

        // Generate QR code PNG as Base64 data URI
        var qrGenerator = new QRCodeGenerator();
        var qrData = qrGenerator.CreateQrCode(otpUri, QRCodeGenerator.ECCLevel.Q);
        var pngQr = new PngByteQRCode(qrData);
        var pngBytes = pngQr.GetGraphic(5);
        var qrBase64 = $"data:image/png;base64,{Convert.ToBase64String(pngBytes)}";

        var encryptedSecret = setting?.TotpSecretEncrypted ?? AesEncrypt(secretBytes);

        // Upsert UserMfaSetting — save pending (IsTotpSetup = false until confirmed)
        if (setting == null)
        {
            setting = new UserMfaSetting
            {
                UserId = userId,
                TotpSecretEncrypted = encryptedSecret,
                IsTotpSetup = false,
                IsMfaEnabled = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await _db.UserMfaSettings.AddAsync(setting);
        }
        else
        {
            setting.TotpSecretEncrypted = encryptedSecret;
            setting.IsTotpSetup = false;
            setting.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();

        return new TotpSetupDto
        {
            Secret = base32Secret,
            QrCodeUri = otpUri,
            QrCodeBase64 = qrBase64
        };
    }

    public async Task<bool> ConfirmTotpSetupAsync(int userId, string code)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        if (setting?.TotpSecretEncrypted == null)
        {
            _logger.LogWarning("TOTP setup confirm failed — no pending setup for UserId: {UserId}", userId);
            return false;
        }

        var secretBytes = AesDecrypt(setting.TotpSecretEncrypted);
        var totp = new Totp(secretBytes);
        var window = new VerificationWindow(previous: 1, future: 1);
        bool valid = totp.VerifyTotp(DateTime.UtcNow, code, out _, window);

        await LogAttemptAsync(userId, "setup", valid, null);

        if (!valid)
        {
            _logger.LogWarning("TOTP setup confirmation failed for UserId: {UserId}", userId);
            return false;
        }

        setting.IsTotpSetup = true;
        setting.IsMfaEnabled = true;
        setting.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("TOTP MFA enabled for UserId: {UserId}", userId);
        return true;
    }

    public async Task<bool> ReactivateTotpAsync(int userId, string code)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        if (setting?.TotpSecretEncrypted == null)
        {
            _logger.LogWarning("TOTP reactivation failed — no stored secret for UserId: {UserId}", userId);
            return false;
        }

        var secretBytes = AesDecrypt(setting.TotpSecretEncrypted);
        var totp = new Totp(secretBytes);
        var window = new VerificationWindow(previous: 1, future: 1);
        bool valid = totp.VerifyTotp(DateTime.UtcNow, code, out _, window);

        await LogAttemptAsync(userId, "reactivate", valid, null);

        if (!valid)
        {
            _logger.LogWarning("TOTP reactivation code invalid for UserId: {UserId}", userId);
            return false;
        }

        setting.IsTotpSetup = true;
        setting.IsMfaEnabled = true;
        setting.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("TOTP MFA reactivated for UserId: {UserId} (existing secret reused)", userId);
        return true;
    }

    public async Task<TotpSetupDto> ResetTotpSetupAsync(int userId, string email)
    {
        // Clear existing secret so GenerateTotpSetupAsync creates a fresh one
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        if (setting != null)
        {
            setting.TotpSecretEncrypted = null;
            setting.IsTotpSetup = false;
            setting.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return await GenerateTotpSetupAsync(userId, email);
    }

    public async Task<bool> DisableTotpAsync(int userId)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        if (setting == null) return true;

        setting.IsMfaEnabled = false;
        setting.IsTotpSetup = false;
        setting.RecoveryCodes = null;
        setting.PreferredMfaMethod = null;
        setting.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Revoke all trusted devices when MFA is disabled
        await RevokeAllTrustedDevicesAsync(userId);

        _logger.LogInformation("MFA disabled for UserId: {UserId}", userId);
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Email OTP
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<bool> SendEmailOtpAsync(int userId, string email)
    {
        try
        {
            // Invalidate any existing unused codes for this user
            var existingCodes = await _db.MfaOtpCodes
                .Where(c => c.UserId == userId && !c.IsUsed)
                .ToListAsync();
            foreach (var c in existingCodes)
                c.IsUsed = true;

            // Generate a 6-digit code
            var code = Random.Shared.Next(100000, 999999).ToString();
            var codeHash = PasswordHelper.ComputeSha256Hash(code);

            var otpRecord = new MfaOtpCode
            {
                UserId = userId,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_settings.EmailOtpExpiryMinutes),
                IsUsed = false,
                AttemptCount = 0
            };
            await _db.MfaOtpCodes.AddAsync(otpRecord);
            await _db.SaveChangesAsync();

            // Send email — resolve SMTP per the user's customer
            var customerId = await _db.WebAppUsers
                .Where(u => u.UserId == userId)
                .Select(u => u.CustomerId)
                .FirstOrDefaultAsync();
            await SendOtpEmail(customerId, email, code, _settings.EmailOtpExpiryMinutes);

            _logger.LogInformation("Email OTP sent to UserId: {UserId}", userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email OTP for UserId: {UserId}", userId);
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Challenge (Login Step 2)
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<string> CreateChallengeAsync(int userId, string method)
    {
        var rawToken = PasswordHelper.GenerateSecureToken();
        var tokenHash = PasswordHelper.ComputeSha256Hash(rawToken);

        var challenge = new MfaChallenge
        {
            UserId = userId,
            ChallengeTokenHash = tokenHash,
            MfaMethod = method,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(_settings.MfaChallengeExpiryMinutes),
            IsUsed = false
        };
        await _db.MfaChallenges.AddAsync(challenge);
        await _db.SaveChangesAsync();

        return rawToken;
    }

    public async Task<bool> VerifyChallengeAsync(int userId, string rawToken, string code, string method, string ipAddress)
    {
        // Check lockout before doing anything
        if (await IsLockedOutAsync(userId, method))
        {
            _logger.LogWarning("MFA attempt blocked — user locked out. UserId: {UserId}, Method: {Method}", userId, method);
            return false;
        }

        // Find the active challenge
        var tokenHash = PasswordHelper.ComputeSha256Hash(rawToken);
        var challenge = await _db.MfaChallenges
            .FirstOrDefaultAsync(c =>
                c.ChallengeTokenHash == tokenHash &&
                c.UserId == userId &&
                !c.IsUsed &&
                c.ExpiresAt > DateTime.UtcNow);

        if (challenge == null)
        {
            _logger.LogWarning("Invalid or expired MFA challenge for UserId: {UserId}", userId);
            return false;
        }

        bool verified = method.ToLowerInvariant() switch
        {
            "totp" => await VerifyTotpCode(userId, code),
            "email" => await VerifyEmailOtp(userId, code),
            "recovery" => await VerifyRecoveryCode(userId, code),
            _ => false
        };

        await LogAttemptAsync(userId, method, verified, ipAddress);

        if (verified)
        {
            challenge.IsUsed = true;
            await _db.SaveChangesAsync();
            _logger.LogInformation("MFA verified successfully for UserId: {UserId} via {Method}", userId, method);
        }
        else
        {
            _logger.LogWarning("MFA verification failed for UserId: {UserId} via {Method}", userId, method);
        }

        return verified;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rate Limiting
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<bool> IsLockedOutAsync(int userId, string attemptType)
    {
        var since = DateTime.UtcNow.AddMinutes(-15);
        var failCount = await _db.MfaAttemptLogs
            .CountAsync(l =>
                l.UserId == userId &&
                l.AttemptType == attemptType &&
                !l.IsSuccess &&
                l.CreatedAt >= since);

        return failCount >= _settings.MaxMfaAttempts;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Recovery Codes
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<int> GetRemainingRecoveryCodesCountAsync(int userId)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        if (string.IsNullOrEmpty(setting?.RecoveryCodes)) return 0;

        var hashes = JsonConvert.DeserializeObject<List<string>>(setting.RecoveryCodes);
        return hashes?.Count ?? 0;
    }

    public async Task<RecoveryCodesDto> RegenerateRecoveryCodesAsync(int userId)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        if (setting == null)
            throw new InvalidOperationException("User MFA settings not found. Enable MFA first.");

        // Generate 8 plaintext codes of 10 characters each
        var plainCodes = new List<string>();
        var hashes = new List<string>();
        for (int i = 0; i < 8; i++)
        {
            var plain = GenerateRecoveryCode();
            plainCodes.Add(plain);
            hashes.Add(PasswordHelper.HashPassword(plain));
        }

        setting.RecoveryCodes = JsonConvert.SerializeObject(hashes);
        setting.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Recovery codes regenerated for UserId: {UserId}", userId);
        return new RecoveryCodesDto { Codes = plainCodes };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Trusted Devices
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<bool> IsTrustedDeviceAsync(int userId, string rawToken)
    {
        var tokenHash = PasswordHelper.ComputeSha256Hash(rawToken);
        return await _db.MfaTrustedDevices.AnyAsync(d =>
            d.UserId == userId &&
            d.DeviceTokenHash == tokenHash &&
            !d.IsRevoked &&
            (d.ExpiresAt == null || d.ExpiresAt > DateTime.UtcNow));
    }

    public async Task<string> CreateTrustedDeviceAsync(int userId, string deviceInfo, string ipAddress, bool force30Day)
    {
        var rawToken = PasswordHelper.GenerateSecureToken();
        var tokenHash = PasswordHelper.ComputeSha256Hash(rawToken);

        var device = new MfaTrustedDevice
        {
            UserId = userId,
            DeviceTokenHash = tokenHash,
            DeviceInfo = deviceInfo,
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = force30Day ? DateTime.UtcNow.AddDays(30) : null,
            IsRevoked = false
        };
        await _db.MfaTrustedDevices.AddAsync(device);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Trusted device created for UserId: {UserId}, Force30Day: {Force30Day}", userId, force30Day);
        return rawToken;
    }

    public async Task RevokeAllTrustedDevicesAsync(int userId)
    {
        var devices = await _db.MfaTrustedDevices
            .Where(d => d.UserId == userId && !d.IsRevoked)
            .ToListAsync();

        foreach (var d in devices)
            d.IsRevoked = true;

        if (devices.Count > 0)
        {
            await _db.SaveChangesAsync();
            _logger.LogInformation("Revoked {Count} trusted devices for UserId: {UserId}", devices.Count, userId);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Preferred Method
    // ─────────────────────────────────────────────────────────────────────────

    public async Task SetPreferredMethodAsync(int userId, string method)
    {
        if (method != "totp" && method != "email")
            throw new InvalidOperationException("Method must be 'totp' or 'email'.");

        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        if (setting == null)
            throw new InvalidOperationException("MFA settings not found. Enable MFA first.");

        if (method == "totp" && !setting.IsTotpSetup)
            throw new InvalidOperationException("TOTP is not set up. Set up an authenticator app first.");

        setting.PreferredMfaMethod = method;
        setting.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Preferred MFA method set to '{Method}' for UserId: {UserId}", method, userId);
    }

    public async Task<string?> GetPreferredMethodAsync(int userId)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        return setting?.PreferredMfaMethod;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────────────────

    public async Task CleanupExpiredAsync()
    {
        var cutoff = DateTime.UtcNow.AddDays(-1);
        var logCutoff = DateTime.UtcNow.AddDays(-30);
        var deviceCutoff = DateTime.UtcNow.AddDays(-90);

        var oldChallenges = await _db.MfaChallenges
            .Where(c => c.ExpiresAt < cutoff)
            .ToListAsync();
        _db.MfaChallenges.RemoveRange(oldChallenges);

        var oldOtpCodes = await _db.MfaOtpCodes
            .Where(c => c.ExpiresAt < cutoff)
            .ToListAsync();
        _db.MfaOtpCodes.RemoveRange(oldOtpCodes);

        var oldLogs = await _db.MfaAttemptLogs
            .Where(l => l.CreatedAt < logCutoff)
            .ToListAsync();
        _db.MfaAttemptLogs.RemoveRange(oldLogs);

        // Clean up expired or revoked trusted devices
        var oldDevices = await _db.MfaTrustedDevices
            .Where(d => (d.ExpiresAt != null && d.ExpiresAt < DateTime.UtcNow) ||
                        (d.IsRevoked && d.CreatedAt < deviceCutoff))
            .ToListAsync();
        _db.MfaTrustedDevices.RemoveRange(oldDevices);

        await _db.SaveChangesAsync();
        _logger.LogInformation("MFA cleanup complete. Removed {C} challenges, {O} OTP codes, {L} logs, {D} trusted devices.",
            oldChallenges.Count, oldOtpCodes.Count, oldLogs.Count, oldDevices.Count);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private async Task<bool> VerifyTotpCode(int userId, string code)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId && x.IsTotpSetup);
        if (setting?.TotpSecretEncrypted == null) return false;

        var secretBytes = AesDecrypt(setting.TotpSecretEncrypted);
        var totp = new Totp(secretBytes);
        var window = new VerificationWindow(previous: 1, future: 1);
        return totp.VerifyTotp(DateTime.UtcNow, code, out _, window);
    }

    private async Task<bool> VerifyEmailOtp(int userId, string code)
    {
        var codeHash = PasswordHelper.ComputeSha256Hash(code);
        var otpRecord = await _db.MfaOtpCodes
            .FirstOrDefaultAsync(c =>
                c.UserId == userId &&
                !c.IsUsed &&
                c.ExpiresAt > DateTime.UtcNow);

        if (otpRecord == null) return false;

        // Increment attempt count
        otpRecord.AttemptCount++;

        // Invalidate after too many attempts
        if (otpRecord.AttemptCount >= _settings.MaxMfaAttempts)
        {
            otpRecord.IsUsed = true;
            await _db.SaveChangesAsync();
            return false;
        }

        if (otpRecord.CodeHash != codeHash)
        {
            await _db.SaveChangesAsync();
            return false;
        }

        // Correct code
        otpRecord.IsUsed = true;
        await _db.SaveChangesAsync();
        return true;
    }

    private async Task<bool> VerifyRecoveryCode(int userId, string code)
    {
        var setting = await _db.UserMfaSettings.FirstOrDefaultAsync(x => x.UserId == userId);
        if (string.IsNullOrEmpty(setting?.RecoveryCodes)) return false;

        var hashes = JsonConvert.DeserializeObject<List<string>>(setting.RecoveryCodes);
        if (hashes == null || hashes.Count == 0) return false;

        string? matchedHash = null;
        foreach (var hash in hashes)
        {
            if (PasswordHelper.VerifyPassword(code, hash))
            {
                matchedHash = hash;
                break;
            }
        }

        if (matchedHash == null) return false;

        // Consume the code (remove it from the list)
        hashes.Remove(matchedHash);
        setting.RecoveryCodes = JsonConvert.SerializeObject(hashes);
        setting.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Recovery code used for UserId: {UserId}. Remaining: {Count}", userId, hashes.Count);
        return true;
    }

    private async Task LogAttemptAsync(int userId, string attemptType, bool isSuccess, string? ipAddress)
    {
        var log = new MfaAttemptLog
        {
            UserId = userId,
            AttemptType = attemptType.ToLowerInvariant(),
            IsSuccess = isSuccess,
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow
        };
        await _db.MfaAttemptLogs.AddAsync(log);
        await _db.SaveChangesAsync();
    }

    private static string GenerateRecoveryCode()
    {
        // 10-character alphanumeric code (uppercase)
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
        var bytes = RandomNumberGenerator.GetBytes(10);
        return new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AES-256 Encrypt/Decrypt
    // ─────────────────────────────────────────────────────────────────────────

    private string AesEncrypt(byte[] data)
    {
        using var aes = Aes.Create();
        aes.Key = Encoding.UTF8.GetBytes(_settings.MfaEncryptionKey)[..32];
        aes.GenerateIV();
        using var enc = aes.CreateEncryptor();
        var cipher = enc.TransformFinalBlock(data, 0, data.Length);
        // Prepend the 16-byte IV so we can extract it during decryption
        var combined = aes.IV.Concat(cipher).ToArray();
        return Convert.ToBase64String(combined);
    }

    private byte[] AesDecrypt(string base64)
    {
        var combined = Convert.FromBase64String(base64);
        using var aes = Aes.Create();
        aes.Key = Encoding.UTF8.GetBytes(_settings.MfaEncryptionKey)[..32];
        aes.IV = combined[..16];
        using var dec = aes.CreateDecryptor();
        return dec.TransformFinalBlock(combined, 16, combined.Length - 16);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Email Sending (follows same pattern as AppUserService.SendPasswordResetEmail)
    // ─────────────────────────────────────────────────────────────────────────

    private async Task SendOtpEmail(int? customerId, string toEmail, string code, int expiryMinutes)
    {
        var smtpSettings = await _smtpResolver.ResolveAsync(customerId, storeId: null);

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(smtpSettings.FromName ?? "RDT System", smtpSettings.FromEmail));
        message.To.Add(new MailboxAddress("", toEmail));
        message.Subject = "Your MFA Verification Code - RDT System";

        var body = new BodyBuilder
        {
            HtmlBody = $@"
<!DOCTYPE html>
<html lang='en'>
<head><meta charset='UTF-8'><title>MFA Verification Code</title></head>
<body style='font-family: Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 0;'>
  <table align='center' cellpadding='0' cellspacing='0' width='100%' style='background-color: #f5f7fa; padding: 20px;'>
    <tr><td>
      <table align='center' cellpadding='0' cellspacing='0' width='600'
             style='background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);'>
        <tr>
          <td style='background-color: #1e1e60; padding: 40px 30px; text-align: center;'>
            <h1 style='color: #ffffff; margin: 0; font-size: 24px;'>Verification Code</h1>
          </td>
        </tr>
        <tr>
          <td style='padding: 30px; color: #333333; font-size: 16px;'>
            <p>Hello,</p>
            <p>Use the code below to complete your sign-in to <strong>RDT System</strong>.</p>
            <div style='text-align: center; margin: 30px 0;'>
              <span style='font-size: 36px; font-weight: bold; letter-spacing: 8px;
                           color: #1e1e60; background-color: #f0f2ff; padding: 16px 32px;
                           border-radius: 8px; display: inline-block;'>{code}</span>
            </div>
            <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;' />
            <p style='color: #999999; font-size: 14px;'>
              This code expires in <strong>{expiryMinutes} minutes</strong>.
            </p>
            <p style='color: #999999; font-size: 14px;'>
              If you did not attempt to log in, please change your password immediately.
            </p>
          </td>
        </tr>
        <tr>
          <td style='background-color: #f1f1f1; text-align: center; padding: 20px; color: #999999; font-size: 13px;'>
            &copy; {DateTime.Now.Year} RDT System. All rights reserved.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"
        };

        message.Body = body.ToMessageBody();

        await MailKitSender.SendAsync(smtpSettings, message);
    }
}
