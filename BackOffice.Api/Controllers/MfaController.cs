using BackOffice.Application.DTOs.Auth;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Persistence.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class MfaController : ControllerBase
{
    private readonly IMfaService _mfaService;
    private readonly IWebAppUserService _appUserService;
    private readonly MainDBContext _db;

    public MfaController(
        IMfaService mfaService,
        IWebAppUserService appUserService,
        MainDBContext db)
    {
        _mfaService = mfaService;
        _appUserService = appUserService;
        _db = db;
    }

    private int GetCurrentUserId()
    {
        var claim = User.Claims.FirstOrDefault(c => c.Type == "UserId");
        return claim != null ? int.Parse(claim.Value) : throw new UnauthorizedAccessException("UserId claim missing.");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/Mfa/status
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var status = await _mfaService.GetStatusAsync(GetCurrentUserId());
        return Ok(ApiResponseFactory.Success(status, "MFA status retrieved."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/Mfa/totp/setup
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("totp/setup")]
    public async Task<IActionResult> SetupTotp()
    {
        var userId = GetCurrentUserId();
        var user = await _appUserService.GetByIdAsync(userId);
        if (user?.Email == null)
            return BadRequest(ApiResponseFactory.BadRequest<object>("User email not found."));

        var setup = await _mfaService.GenerateTotpSetupAsync(userId, user.Email);
        return Ok(ApiResponseFactory.Success(setup, "Scan the QR code with your authenticator app, then verify with a code."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/Mfa/totp/verify-setup
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("totp/verify-setup")]
    public async Task<IActionResult> VerifyTotpSetup([FromBody] VerifyTotpSetupRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest(ApiResponseFactory.BadRequest<object>("Code is required."));

        var ok = await _mfaService.ConfirmTotpSetupAsync(GetCurrentUserId(), dto.Code);
        if (!ok)
            return BadRequest(ApiResponseFactory.BadRequest<object>("Invalid code. Please try again."));

        return Ok(ApiResponseFactory.Success<object>(null, "MFA has been enabled successfully. You will now be required to enter a code on login."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/Mfa/totp/disable
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("totp/disable")]
    public async Task<IActionResult> DisableTotp()
    {
        await _mfaService.DisableTotpAsync(GetCurrentUserId());
        return Ok(ApiResponseFactory.Success<object>(null, "MFA has been disabled."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/Mfa/totp/reactivate — re-enable MFA using existing authenticator app
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("totp/reactivate")]
    public async Task<IActionResult> ReactivateTotp([FromBody] VerifyTotpSetupRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest(ApiResponseFactory.BadRequest<object>("Code is required."));

        var ok = await _mfaService.ReactivateTotpAsync(GetCurrentUserId(), dto.Code);
        if (!ok)
            return BadRequest(ApiResponseFactory.BadRequest<object>("Wrong code, please try again."));

        return Ok(ApiResponseFactory.Success<object>(null, "MFA has been re-enabled using your existing authenticator app."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/Mfa/totp/reset-setup — generate a fresh TOTP secret (discard old one)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("totp/reset-setup")]
    public async Task<IActionResult> ResetTotpSetup()
    {
        var userId = GetCurrentUserId();
        var user = await _appUserService.GetByIdAsync(userId);
        if (user?.Email == null)
            return BadRequest(ApiResponseFactory.BadRequest<object>("User email not found."));

        var setup = await _mfaService.ResetTotpSetupAsync(userId, user.Email);
        return Ok(ApiResponseFactory.Success(setup, "New authenticator setup created. Scan the QR code and verify."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/Mfa/preferred-method
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("preferred-method")]
    public async Task<IActionResult> GetPreferredMethod()
    {
        var method = await _mfaService.GetPreferredMethodAsync(GetCurrentUserId());
        return Ok(ApiResponseFactory.Success(new { method }, "Preferred MFA method retrieved."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/Mfa/preferred-method
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("preferred-method")]
    public async Task<IActionResult> SetPreferredMethod([FromBody] SetPreferredMethodDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Method) || (dto.Method != "totp" && dto.Method != "email"))
            return BadRequest(ApiResponseFactory.BadRequest<object>("Method must be 'totp' or 'email'."));

        try
        {
            await _mfaService.SetPreferredMethodAsync(GetCurrentUserId(), dto.Method);
            return Ok(ApiResponseFactory.Success<object>(null, "Preferred MFA method updated."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponseFactory.BadRequest<object>(ex.Message));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/Mfa/config/{key}  — read a GlobalConfig value (admin)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("config/{key}")]
    public async Task<IActionResult> GetConfig(string key)
    {
        var config = await _db.GlobalConfigs.FirstOrDefaultAsync(c => c.ConfigKey == key);
        if (config == null)
            return NotFound(ApiResponseFactory.NotFound<object>($"Config key '{key}' not found."));

        return Ok(ApiResponseFactory.Success(new { value = config.ConfigValue }, $"Config '{key}' retrieved."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/Mfa/config/{key}  — update a GlobalConfig value (admin)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPut("config/{key}")]
    public async Task<IActionResult> UpdateConfig(string key, [FromBody] UpdateConfigDto dto)
    {
        var config = await _db.GlobalConfigs.FirstOrDefaultAsync(c => c.ConfigKey == key);
        if (config == null)
            return NotFound(ApiResponseFactory.NotFound<object>($"Config key '{key}' not found."));

        config.ConfigValue = dto.Value;
        config.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponseFactory.Success<object>(null, $"Config '{key}' updated."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/Mfa/email/send-otp  [AllowAnonymous — uses MFA token, no JWT]
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("email/send-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> SendEmailOtp([FromBody] SendEmailOtpRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.MfaToken))
            return BadRequest(ApiResponseFactory.BadRequest<object>("MFA token is required."));

        // Resolve user from MFA challenge token (no JWT available here)
        var tokenHash = PasswordHelper.ComputeSha256Hash(dto.MfaToken);
        var challenge = await _db.MfaChallenges
            .FirstOrDefaultAsync(c =>
                c.ChallengeTokenHash == tokenHash &&
                !c.IsUsed &&
                c.ExpiresAt > DateTime.UtcNow);

        if (challenge == null)
            return Unauthorized(ApiResponseFactory.Unauthorized<object>("Invalid or expired MFA token."));

        var user = await _appUserService.GetByIdAsync(challenge.UserId);
        if (user?.Email == null)
            return BadRequest(ApiResponseFactory.BadRequest<object>("No email address on file for this account."));

        await _mfaService.SendEmailOtpAsync(challenge.UserId, user.Email);

        // Always return success (avoid leaking whether the send actually worked)
        return Ok(ApiResponseFactory.Success<object>(null, "A verification code has been sent to your email address."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/Mfa/recovery-codes/count
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("recovery-codes/count")]
    public async Task<IActionResult> GetRecoveryCodesCount()
    {
        var count = await _mfaService.GetRemainingRecoveryCodesCountAsync(GetCurrentUserId());
        return Ok(ApiResponseFactory.Success(new { count }, "Recovery codes count retrieved."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/Mfa/recovery-codes/regenerate
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("recovery-codes/regenerate")]
    public async Task<IActionResult> RegenerateRecoveryCodes()
    {
        try
        {
            var codes = await _mfaService.RegenerateRecoveryCodesAsync(GetCurrentUserId());
            return Ok(ApiResponseFactory.Success(codes,
                "Recovery codes regenerated. Save these now — they will not be shown again."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponseFactory.BadRequest<object>(ex.Message));
        }
    }
}
