using BackOffice.Api.Services;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Auth;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Common;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Enums;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Persistence.Helpers;
using BackOffice.Persistence.Services.Main;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Dynamic;
using Microsoft.Extensions.Configuration;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly IWebAppUserService _appUserService;
        private readonly ITenantProvider _tenantProvider;
        private readonly ICustomersMainService _customersMainService;
        private readonly IConfiguration _configuration;
        private readonly ISessionService _sessionService;
        private readonly ISessionCacheService _sessionCacheService;
        private readonly MainDBContext _dbContext;
        private readonly IMfaService _mfaService;
        private readonly IEnvironmentAccessService _environmentAccessService;
        private readonly IUsageTrackingService _usageTrackingService;

        public AuthController(
            IAuthService authService,
            IWebAppUserService appUserService,
            ITenantProvider tenantProvider,
            ICustomersMainService customersMainService,
            IConfiguration configuration,
            ISessionService sessionService,
            ISessionCacheService sessionCacheService,
            MainDBContext dbContext,
            IMfaService mfaService,
            IEnvironmentAccessService environmentAccessService,
            IUsageTrackingService usageTrackingService)
        {
            _authService = authService;
            _appUserService = appUserService;
            _customersMainService = customersMainService;
            _tenantProvider = tenantProvider;
            _configuration = configuration;
            _sessionService = sessionService;
            _sessionCacheService = sessionCacheService;
            _dbContext = dbContext;
            _mfaService = mfaService;
            _environmentAccessService = environmentAccessService;
            _usageTrackingService = usageTrackingService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto loginDto)
        {
            var result = await _appUserService.AuthenticateAsync(loginDto.Email, loginDto.Password);

            if (result == null)
                return Unauthorized("Invalid credentials.");

            var deviceInfo = HttpContext.Request.Headers["User-Agent"].ToString();
            var ipAddress = GetClientIpAddress();

            // CHECK 1: Web access + environment access (must run before any session logic
            //          so that a disabled user cannot even trigger the "already logged in" flow)
            var earlyEnvCheck = await CheckEnvironmentAccessAsync(result.UserId, result.CustomerId, result.IsSuperAdmin == true);
            if (earlyEnvCheck != null) return earlyEnvCheck;

            // CHECK 2: Does this user already have an active session for this customer?
            //
            // Before fetching, prune any sessions for this user whose LastActivityAt
            // is older than 24 hours. Those are abandoned-browser rows (logout API
            // failed silently, browser was force-closed, network died, etc.) that
            // would otherwise trigger the "active session detected" modal for the
            // same user re-logging in from the same browser. Without this, every
            // login after a soft-failed logout shows the modal even when there's
            // no real concurrent-device conflict.
            await _sessionService.DeactivateStaleSessionsAsync(
                result.UserId,
                result.CustomerId,
                TimeSpan.FromHours(24));

            var existingSession = await _sessionService.GetActiveSessionAsync(result.UserId, result.CustomerId);

            if (existingSession != null)
            {
                var (tempToken, _) = await _sessionService.CreateTemporaryLoginTokenAsync(
                    result.UserId, result.CustomerId, "user_session",
                    existingSession.SessionId, deviceInfo, ipAddress);

                return Ok(new LoginConflictResponseDto
                {
                    RequiresConfirmation = true,
                    ConflictType = "user_session",
                    Message = "You are already logged in on another device. Do you want to log out the other session and continue?",
                    TemporaryToken = tempToken,
                    UserActiveSession = new ActiveSessionInfoDto
                    {
                        DeviceInfo = existingSession.DeviceInfo,
                        IpAddress = existingSession.IpAddress,
                        LastActivityAt = existingSession.LastActivityAt
                    }
                });
            }

            // CHECK 3: Is this customer at the concurrent user limit?
            if (result.CustomerId.HasValue)
            {
                var maxUsers = await _sessionService.GetMaxConcurrentUsersAsync(result.CustomerId.Value);
                if (maxUsers > 0) // 0 = unlimited
                {
                    var activeCount = await _sessionService.GetActiveSessionCountAsync(result.CustomerId.Value);
                    if (activeCount >= maxUsers)
                    {
                        var activeSessions = await _sessionService.GetActiveSessionsWithUserInfoAsync(result.CustomerId.Value);

                        var (tempToken, _) = await _sessionService.CreateTemporaryLoginTokenAsync(
                            result.UserId, result.CustomerId, "customer_limit",
                            null, deviceInfo, ipAddress);

                        return Ok(new LoginConflictResponseDto
                        {
                            RequiresConfirmation = true,
                            ConflictType = "customer_limit",
                            Message = $"Maximum active users ({maxUsers}) reached. Please select a session to log out.",
                            TemporaryToken = tempToken,
                            CustomerLimitInfo = new CustomerLimitInfoDto
                            {
                                MaxAllowed = maxUsers,
                                CurrentActive = activeCount
                            },
                            ActiveSessions = activeSessions
                        });
                    }
                }
            }

            // CHECK 3.5: Web App per-user license seat limit. Distinct from CHECK 3:
            //            CHECK 3 enforces Customers.MaxConcurrentUsers (legacy flat cap),
            //            this enforces the per-tenant Web App license slot count from
            //            dbo.CustomerAppLicenses. If no Web App slots are configured,
            //            the service returns Allowed=true (== unlimited).
            if (result.CustomerId.HasValue)
            {
                var seatCheck = await _usageTrackingService.CheckWebAppSeatAsync(
                    result.CustomerId.Value, result.UserId);

                if (seatCheck.IsSuccess
                    && seatCheck.Response != null
                    && !seatCheck.Response.Allowed)
                {
                    return Unauthorized(new
                    {
                        error = "web_seat_limit",
                        message = seatCheck.Response.Reason
                            ?? "Web App seat limit reached. Contact your administrator.",
                        slotsUsed = seatCheck.Response.SlotsUsed,
                        slotsTotal = seatCheck.Response.SlotsTotal,
                    });
                }
            }

            // CHECK 4: Is this customer's account suspended due to payment failure?
            if (result.CustomerId.HasValue)
            {
                var customer = await _dbContext.Customers
                    .Where(c => c.CustomerId == result.CustomerId.Value)
                    .Select(c => new { SubscriptionStatus = c.Subscription != null ? c.Subscription.Status : (SubscriptionStatus?)null })
                    .FirstOrDefaultAsync();

                if (customer?.SubscriptionStatus == SubscriptionStatus.Suspended)
                {
                    return Unauthorized(new
                    {
                        error = "account_suspended",
                        message = "Your account has been suspended due to payment failure. Please contact support or update your payment method."
                    });
                }
            }

            // CHECK 5: Does this user have MFA enabled?
            var mfaSetting = await _dbContext.UserMfaSettings
                .FirstOrDefaultAsync(m => m.UserId == result.UserId);

            if (mfaSetting is { IsMfaEnabled: true })
            {
                // Check for trusted device token (sent via X-Device-Token header from localStorage)
                var trustedDeviceToken = HttpContext.Request.Headers["X-Device-Token"].FirstOrDefault();
                if (!string.IsNullOrEmpty(trustedDeviceToken))
                {
                    var isTrusted = await _mfaService.IsTrustedDeviceAsync(result.UserId, trustedDeviceToken);
                    if (isTrusted)
                    {
                        // Trusted device — skip MFA, go straight to session creation
                        return Ok(await CreateSessionAndTokens(result, deviceInfo, ipAddress));
                    }
                }

                // Determine the preferred MFA method (user preference first, then default to email)
                var method = mfaSetting.PreferredMfaMethod ?? "email";

                // Create a short-lived challenge token (5 min)
                var mfaToken = await _mfaService.CreateChallengeAsync(result.UserId, method);

                // If email method, send the OTP code immediately
                if (method == "email" && !string.IsNullOrEmpty(result.Email))
                    await _mfaService.SendEmailOtpAsync(result.UserId, result.Email);

                // Check admin setting for forced 30-day expiry
                var force30DayConfig = await _dbContext.GlobalConfigs
                    .Where(c => c.ConfigKey == "MfaForce30DayReauth")
                    .Select(c => c.ConfigValue)
                    .FirstOrDefaultAsync();
                var force30Day = force30DayConfig != "false"; // default true

                return Ok(new MfaRequiredResponseDto
                {
                    MfaRequired = true,
                    MfaToken = mfaToken,
                    PreferredMethod = method,
                    Force30DayReauth = force30Day,
                    IsTotpSetup = mfaSetting.IsTotpSetup
                });
            }

            // NO CONFLICT, NO MFA: Create session and issue tokens
            return Ok(await CreateSessionAndTokens(result, deviceInfo, ipAddress));
        }

        [HttpPost("confirm-login")]
        public async Task<IActionResult> ConfirmLogin([FromBody] ConfirmLoginRequestDto dto)
        {
            var tempToken = await _sessionService.ValidateTemporaryTokenAsync(dto.TemporaryToken);
            if (tempToken == null)
                return Unauthorized("Invalid or expired confirmation token. Please try logging in again.");

            // Get the user
            var user = await _appUserService.GetByIdAsync(tempToken.UserId);
            if (user == null)
                return Unauthorized("User not found.");

            // Revoke based on conflict type
            if (tempToken.ConflictType == "user_session" && tempToken.ExistingSessionId.HasValue)
            {
                await _sessionService.RevokeSessionAsync(tempToken.ExistingSessionId.Value, "new_login");
                _sessionCacheService.InvalidateSession(tempToken.ExistingSessionId.Value);
            }
            else if (tempToken.ConflictType == "customer_limit" && tempToken.CustomerId.HasValue)
            {
                if (!dto.SessionIdToRevoke.HasValue)
                    return BadRequest("Please select a session to log out.");

                // Validate the selected session belongs to this customer and is still active
                var isValid = await _sessionService.ValidateSessionBelongsToCustomerAsync(
                    dto.SessionIdToRevoke.Value, tempToken.CustomerId.Value);

                if (!isValid)
                    return BadRequest("The selected session is no longer active or does not belong to this customer.");

                await _sessionService.RevokeSessionAsync(dto.SessionIdToRevoke.Value, "customer_limit");
                _sessionCacheService.InvalidateSession(dto.SessionIdToRevoke.Value);
            }

            // Consume the temporary token
            await _sessionService.ConsumeTemporaryTokenAsync(tempToken.TokenId);

            // Create new session
            var deviceInfo = tempToken.DeviceInfo ?? HttpContext.Request.Headers["User-Agent"].ToString();
            var ipAddress = tempToken.IpAddress ?? GetClientIpAddress();

            // CHECK MFA: Does this user have MFA enabled? (must happen after session revocation)
            var mfaSettingConfirm = await _dbContext.UserMfaSettings
                .FirstOrDefaultAsync(m => m.UserId == user.UserId);

            if (mfaSettingConfirm is { IsMfaEnabled: true })
            {
                // Check for trusted device token (sent via X-Device-Token header from localStorage)
                var trustedDeviceToken = HttpContext.Request.Headers["X-Device-Token"].FirstOrDefault();
                if (!string.IsNullOrEmpty(trustedDeviceToken))
                {
                    var isTrusted = await _mfaService.IsTrustedDeviceAsync(user.UserId, trustedDeviceToken);
                    if (isTrusted)
                    {
                        // Trusted device — skip MFA
                        var confirmEnvCheckTrusted = await CheckEnvironmentAccessAsync(user.UserId, user.CustomerId, user.IsSuperAdmin == true);
                        if (confirmEnvCheckTrusted != null) return confirmEnvCheckTrusted;
                        return Ok(await CreateSessionAndTokens(user, deviceInfo, ipAddress));
                    }
                }

                var method = mfaSettingConfirm.PreferredMfaMethod ?? "email";
                var mfaToken = await _mfaService.CreateChallengeAsync(user.UserId, method);
                if (method == "email" && !string.IsNullOrEmpty(user.Email))
                    await _mfaService.SendEmailOtpAsync(user.UserId, user.Email);

                var force30DayConfigConfirm = await _dbContext.GlobalConfigs
                    .Where(c => c.ConfigKey == "MfaForce30DayReauth")
                    .Select(c => c.ConfigValue)
                    .FirstOrDefaultAsync();

                return Ok(new MfaRequiredResponseDto
                {
                    MfaRequired = true,
                    MfaToken = mfaToken,
                    PreferredMethod = method,
                    Force30DayReauth = force30DayConfigConfirm != "false",
                    IsTotpSetup = mfaSettingConfirm.IsTotpSetup
                });
            }

            // CHECK MFA-ENV: Environment access after session conflict resolved
            var confirmEnvCheck = await CheckEnvironmentAccessAsync(user.UserId, user.CustomerId, user.IsSuperAdmin == true);
            if (confirmEnvCheck != null) return confirmEnvCheck;

            return Ok(await CreateSessionAndTokens(user, deviceInfo, ipAddress));
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            var sidClaim = User.Claims.FirstOrDefault(c => c.Type == "sid")?.Value;

            if (string.IsNullOrEmpty(sidClaim) || !Guid.TryParse(sidClaim, out var sessionId))
                return BadRequest("Invalid session.");

            var revoked = await _sessionService.RevokeSessionAsync(sessionId, "user_logout");
            _sessionCacheService.InvalidateSession(sessionId);

            if (!revoked)
                return NotFound("Session not found.");

            return Ok(new { message = "Logged out successfully." });
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequestDto dto)
        {
            var tokenHash = SessionService.ComputeSha256Hash(dto.RefreshToken);
            var session = await _sessionService.GetSessionByRefreshTokenHashAsync(tokenHash);

            if (session == null || !session.IsActive)
                return Unauthorized(new { error = "Invalid or expired refresh token." });

            if (session.RefreshTokenExpiresAt.HasValue && session.RefreshTokenExpiresAt.Value < DateTime.UtcNow)
            {
                await _sessionService.RevokeSessionAsync(session.SessionId, "expired");
                _sessionCacheService.InvalidateSession(session.SessionId);
                return Unauthorized(new { error = "Refresh token expired. Please login again." });
            }

            // Get user info
            var user = await _appUserService.GetByIdAsync(session.UserId);
            if (user == null)
                return Unauthorized(new { error = "User not found." });

            // Generate new refresh token (rotation)
            var newRefreshToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
            var newHash = SessionService.ComputeSha256Hash(newRefreshToken);
            await _sessionService.UpdateRefreshTokenAsync(session.SessionId, newHash, DateTime.UtcNow.AddDays(30));

            // Generate new access token with same session ID. IsSuperAdmin flag is
            // authoritative; CustomerId == null is the legacy fallback for users
            // created before the flag was backfilled.
            var role = (user.IsSuperAdmin == true || user.CustomerId == null) ? "SuperAdmin" : "User";
            var accessToken = _authService.GenerateAccessToken(
                user.Email, user.UserName, role,
                user.UserId, user.CustomerId, user.LocalUserId, session.SessionId);

            await _sessionService.UpdateLastActivityAsync(session.SessionId);

            return Ok(new RefreshTokenResponseDto
            {
                AccessToken = accessToken,
                RefreshToken = newRefreshToken
            });
        }

        [HttpPost("google-login")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequestDto googleDto)
        {
            try
            {
                var googleClientId = _configuration["GoogleAuth:ClientId"];

                var payload = await GoogleJsonWebSignature.ValidateAsync(googleDto.IdToken, new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { googleClientId }
                });

                var email = payload.Email;
                var name = payload.Name ?? payload.Email;

                var result = await _appUserService.FindOrCreateGoogleUserAsync(email, name);

                if (result == null)
                    return BadRequest("Failed to process Google login.");

                var googleRole = (result.IsSuperAdmin == true || result.CustomerId == null) ? "SuperAdmin" : "User";

                var accessToken = _authService.GenerateAccessToken(
                    result.Email,
                    result.UserName,
                    googleRole,
                    result.UserId,
                    result.CustomerId,
                    result.LocalUserId
                );

                var refreshToken = _authService.GenerateRefreshToken(result.UserId);

                dynamic userData = new ExpandoObject();
                userData.AccessToken = accessToken;
                userData.RefreshToken = refreshToken;
                userData.Email = result.Email;
                userData.UserId = result.UserId;
                userData.LocalUserId = result.LocalUserId;
                userData.Username = result.UserName;
                userData.Role = googleRole;
                userData.CustomerId = result.CustomerId;
                userData.LoginType = "Google";

                return Ok(userData);
            }
            catch (InvalidJwtException)
            {
                return Unauthorized("Invalid Google token.");
            }
        }

        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email))
                return BadRequest("Email is required.");

            var result = await _appUserService.ForgotPasswordAsync(dto.Email.Trim());
            return Ok(result);
        }

        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Token))
                return BadRequest("Token is required.");

            if (string.IsNullOrWhiteSpace(dto.NewPassword))
                return BadRequest("New password is required.");

            if (dto.NewPassword != dto.ConfirmPassword)
                return BadRequest("Passwords do not match.");

            if (dto.NewPassword.Length < 6)
                return BadRequest("Password must be at least 6 characters long.");

            var result = await _appUserService.ResetPasswordAsync(dto.Token, dto.NewPassword);

            if (!result.IsSuccess)
                return BadRequest(result);

            return Ok(result);
        }

        [HttpPost("verify-mfa")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyMfa([FromBody] VerifyMfaRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.MfaToken) || string.IsNullOrWhiteSpace(dto.Code) || string.IsNullOrWhiteSpace(dto.Method))
                return BadRequest("MfaToken, Code, and Method are required.");

            // Resolve the challenge from the hashed token
            var tokenHash = PasswordHelper.ComputeSha256Hash(dto.MfaToken);
            var challenge = await _dbContext.MfaChallenges
                .FirstOrDefaultAsync(c =>
                    c.ChallengeTokenHash == tokenHash &&
                    !c.IsUsed &&
                    c.ExpiresAt > DateTime.UtcNow);

            if (challenge == null)
                return Unauthorized("Invalid or expired MFA token. Please log in again.");

            var ipAddress = GetClientIpAddress();
            var verified = await _mfaService.VerifyChallengeAsync(
                challenge.UserId, dto.MfaToken, dto.Code, dto.Method, ipAddress);

            if (!verified)
                return Unauthorized("Wrong code, please try again.");

            // Load user and create full session + JWT
            var user = await _appUserService.GetByIdAsync(challenge.UserId);
            if (user == null)
                return Unauthorized("User not found.");

            // CHECK ENV: Environment access after MFA verified
            var mfaEnvCheck = await CheckEnvironmentAccessAsync(user.UserId, user.CustomerId, user.IsSuperAdmin == true);
            if (mfaEnvCheck != null) return mfaEnvCheck;

            var deviceInfo = HttpContext.Request.Headers["User-Agent"].ToString();

            // If "Remember device" was checked, create a trusted device token
            string? trustedDeviceTokenResult = null;
            DateTime? deviceTokenExpiresAt = null;
            if (dto.RememberDevice)
            {
                var force30DayConfig = await _dbContext.GlobalConfigs
                    .Where(c => c.ConfigKey == "MfaForce30DayReauth")
                    .Select(c => c.ConfigValue)
                    .FirstOrDefaultAsync();
                var force30Day = force30DayConfig != "false"; // default true

                trustedDeviceTokenResult = await _mfaService.CreateTrustedDeviceAsync(
                    user.UserId, deviceInfo, ipAddress, force30Day);

                if (force30Day)
                    deviceTokenExpiresAt = DateTime.UtcNow.AddDays(30);
            }

            var loginResponse = await CreateSessionAndTokens(user, deviceInfo, ipAddress);

            // Merge the device token into the login response so the frontend can store it
            if (trustedDeviceTokenResult != null)
            {
                loginResponse.DeviceToken = trustedDeviceTokenResult;
                loginResponse.DeviceTokenExpiresAt = deviceTokenExpiresAt?.ToString("o"); // ISO 8601
            }

            return Ok(loginResponse);
        }

        #region Private Helpers

        /// <summary>
        /// CHECK 5 — Validates that the user has web access and is permitted for the
        /// current deployment environment. Returns a non-null IActionResult (403) when
        /// access should be denied, or null when the check passes.
        /// SuperAdmins (IsSuperAdmin flag, with the legacy CustomerId == null fallback)
        /// always pass.
        /// </summary>
        private async Task<IActionResult?> CheckEnvironmentAccessAsync(int userId, int? customerId, bool isSuperAdmin = false)
        {
            // SuperAdmins bypass all environment checks
            if (isSuperAdmin || customerId == null) return null;

            // Check 5a: HasWebAccess
            var hasWebAccess = await _environmentAccessService.HasWebAccessAsync(userId);
            if (!hasWebAccess)
            {
                return StatusCode(403, new
                {
                    error = "web_access_denied",
                    message = "Your account does not have access to this application. Please contact your administrator."
                });
            }

            // Check 5b: CurrentEnvironmentId mapping (GUID from appsettings)
            var currentEnvIdStr = (_configuration["CurrentEnvironmentId"] ?? "").Trim();
            if (Guid.TryParse(currentEnvIdStr, out var currentEnvId) && currentEnvId != Guid.Empty)
            {
                var hasEnvAccess = await _environmentAccessService.HasEnvironmentAccessByIdAsync(
                    userId, customerId.Value, currentEnvId);

                if (!hasEnvAccess)
                {
                    return StatusCode(403, new
                    {
                        error = "environment_access_denied",
                        message = "Your account is not authorized for this environment. Please contact your administrator."
                    });
                }
            }

            return null;
        }

        private string GetClientIpAddress()
        {
            // Check X-Forwarded-For header first (set by reverse proxies / load balancers)
            var forwardedFor = HttpContext.Request.Headers["X-Forwarded-For"].ToString();
            if (!string.IsNullOrEmpty(forwardedFor))
            {
                // Take the first IP (original client), trim whitespace
                var firstIp = forwardedFor.Split(',')[0].Trim();
                if (!string.IsNullOrEmpty(firstIp))
                    return firstIp;
            }

            var remoteIp = HttpContext.Connection.RemoteIpAddress;
            if (remoteIp == null) return "unknown";

            // Map IPv6 loopback (::1) to IPv4 loopback (127.0.0.1)
            if (System.Net.IPAddress.IsLoopback(remoteIp))
                return "127.0.0.1";

            // Map IPv6-mapped IPv4 (e.g. ::ffff:192.168.1.1) to plain IPv4
            if (remoteIp.IsIPv4MappedToIPv6)
                return remoteIp.MapToIPv4().ToString();

            return remoteIp.ToString();
        }

        private async Task<LoginResponseDto> CreateSessionAndTokens(WebAppUser user, string deviceInfo, string ipAddress)
        {
            var role = (user.IsSuperAdmin == true || user.CustomerId == null) ? "SuperAdmin" : "User";

            // Generate refresh token (crypto random, not JWT)
            var refreshToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
            var refreshTokenHash = SessionService.ComputeSha256Hash(refreshToken);

            // Create session in DB
            var session = await _sessionService.CreateSessionAsync(
                user.UserId, user.CustomerId, deviceInfo, ipAddress, refreshTokenHash);

            // Cache the new session
            _sessionCacheService.CacheSessionActive(session.SessionId);

            // Generate access token with session ID
            var accessToken = _authService.GenerateAccessToken(
                user.Email,
                user.UserName,
                role,
                user.UserId,
                user.CustomerId,
                user.LocalUserId,
                session.SessionId);

            // Determine billing status for the customer
            var billingStatus = "ok";
            if (user.CustomerId.HasValue)
            {
                var subStatus = await _dbContext.Customers
                    .Where(c => c.CustomerId == user.CustomerId.Value)
                    .Select(c => c.Subscription != null ? c.Subscription.Status : (SubscriptionStatus?)null)
                    .FirstOrDefaultAsync();

                billingStatus = subStatus switch
                {
                    SubscriptionStatus.PastDue => "past_due",
                    SubscriptionStatus.Trial => "trial",
                    SubscriptionStatus.Suspended => "suspended", // shouldn't reach here due to CHECK 3, but safety
                    _ => "ok"
                };
            }

            return new LoginResponseDto
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                Email = user.Email,
                UserId = user.UserId,
                LocalUserId = user.LocalUserId,
                Username = user.UserName,
                Role = role,
                CustomerId = user.CustomerId,
                SessionId = session.SessionId,
                BillingStatus = billingStatus
            };
        }

        #endregion
    }
}
