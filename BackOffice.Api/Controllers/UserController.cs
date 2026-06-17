using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Mian.User;
using BackOffice.Application.DTOs.Tenant.User;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UserController : ControllerBase
    {
        private readonly IWebAppUserService _appuserService;
        private readonly IWebUserManagementService _userManagementService;
        private readonly IMapper _mapper;
        private readonly ITenantProvider _tenantProvider;
        private readonly IS3StorageService _s3StorageService;

        // Allowed profile-image content types / size, mirroring ItemsController.UploadImage.
        private static readonly string[] AllowedImageTypes =
            { "image/jpeg", "image/png", "image/gif", "image/webp" };
        private const long MaxImageBytes = 5 * 1024 * 1024; // 5 MB

        public UserController(
            IWebAppUserService appuserService,
            IWebUserManagementService userManagementService,
            IMapper mapper,
            ITenantProvider tenantProvider,
            IS3StorageService s3StorageService)
        {
            _appuserService = appuserService;
            _userManagementService = userManagementService;
            _mapper = mapper;
            _tenantProvider = tenantProvider;
            _s3StorageService = s3StorageService;
        }

        [HttpGet("GetAllUsers")]
        public async Task<IActionResult> GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var users = _appuserService.GetAllAsync(paginationGridDto);
            return Ok(users);
        }

        [AllowAnonymous]
        [HttpPost("ModifyUserEmail")]
        public async Task<IActionResult> ModifyUserEmail([FromBody] ModifyUserEmailDto dto)
        {
            var result = await _appuserService.ModifyUserEmailAsync(dto);
            return Ok(new { success = result, message = result ? "Email updated successfully." : "Failed to update email." });
        }

        [HttpGet("GetDistinctUsers")]
        public async Task<IActionResult> GetDistinctUsers()
        {
            var result = await _appuserService.GetDistinctUsersAsync();
            return Ok(result);
        }

        [HttpGet("GetUsersByCustomer/{customerId}")]
        public async Task<IActionResult> GetUsersByCustomer(int customerId)
        {
            var result = await _appuserService.GetUsersByCustomerIdAsync(customerId);
            return Ok(result);
        }

        [HttpGet("GetUserById/{tenantUserId}")]
        public async Task<IActionResult> GetUserById(Guid tenantUserId)
        {
            var result = await _userManagementService.GetUserByIdAsync(tenantUserId);
            return Ok(result);
        }

        [HttpPost("CreateUser")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
        {
            var customerId = GetCurrentCustomerId();
            if (customerId <= 0)
                return BadRequest(new { isSuccess = false, message = "CustomerId is required" });
            var result = await _userManagementService.CreateUserAsync(dto, customerId, IsCallerSuperAdmin());
            return Ok(result);
        }


        [HttpPut("UpdateUser")]
        public async Task<IActionResult> UpdateUser([FromBody] UpdateUserDto dto)
        {
            var result = await _userManagementService.UpdateUserAsync(dto, IsCallerSuperAdmin());
            return Ok(result);
        }


        [HttpDelete("DeleteUser/{tenantUserId}")]
        public async Task<IActionResult> DeleteUser(Guid tenantUserId)
        {

            var result = await _userManagementService.DeleteUserAsync(tenantUserId);
            return Ok(result);
        }

        // ===================================================================
        // Self-service profile (the /profile page)
        // The acting user is ALWAYS resolved from the JWT "UserId" claim (the
        // WebAppUser primary key) — never from a route/body value — so a user
        // can only ever read/update their own, exact record.
        // ===================================================================

        /// <summary>Returns the logged-in user's own profile (with a pre-signed image URL).</summary>
        [HttpGet("Me")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { isSuccess = false, message = "Could not identify the current user." });

            var result = await _userManagementService.GetMyProfileAsync(userId.Value);
            if (result.IsSuccess && result.Response != null)
                result.Response.ProfileImageUrl = BuildImageUrl(result.Response.ProfileImagePath);

            return Ok(result);
        }

        /// <summary>Updates the logged-in user's email / phone across all their user rows.</summary>
        [HttpPut("UpdateMyProfile")]
        public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateMyProfileDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { isSuccess = false, message = "Could not identify the current user." });

            var result = await _userManagementService.UpdateMyProfileAsync(userId.Value, dto);
            if (result.IsSuccess && result.Response != null)
                result.Response.ProfileImageUrl = BuildImageUrl(result.Response.ProfileImagePath);

            return Ok(result);
        }

        /// <summary>Changes the logged-in user's password (after verifying the current one).</summary>
        [HttpPost("ChangeMyPassword")]
        public async Task<IActionResult> ChangeMyPassword([FromBody] ChangePasswordDto dto)
        {
            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { isSuccess = false, message = "Could not identify the current user." });

            var result = await _userManagementService.ChangeMyPasswordAsync(userId.Value, dto);
            return Ok(result);
        }

        /// <summary>Uploads (or replaces) the logged-in user's profile image. Stored only on the app-user row.</summary>
        [HttpPost("UploadProfileImage")]
        public async Task<IActionResult> UploadProfileImage(IFormFile file)
        {
            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { isSuccess = false, message = "Could not identify the current user." });

            if (file == null || file.Length == 0)
                return BadRequest(new { isSuccess = false, message = "No file uploaded." });

            if (!AllowedImageTypes.Contains(file.ContentType?.ToLowerInvariant()))
                return BadRequest(new { isSuccess = false, message = "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed." });

            if (file.Length > MaxImageBytes)
                return BadRequest(new { isSuccess = false, message = "File size exceeds 5MB limit." });

            try
            {
                // Look up any existing image so we can delete it after the new one
                // is safely persisted (avoids orphaning the old S3 object).
                var existing = await _userManagementService.GetMyProfileAsync(userId.Value);
                var oldPath = existing.IsSuccess ? existing.Response?.ProfileImagePath : null;

                var extension = System.IO.Path.GetExtension(file.FileName);
                var fileName = $"profile-{Guid.NewGuid()}{extension}";

                using var stream = file.OpenReadStream();
                var s3Path = await _s3StorageService.UploadFileAsync(stream, fileName, file.ContentType);

                var saveResult = await _userManagementService.UpdateProfileImageAsync(userId.Value, s3Path);
                if (!saveResult.IsSuccess)
                {
                    // Persisting the path failed — clean up the just-uploaded object.
                    await SafeDeleteAsync(s3Path);
                    return Ok(saveResult);
                }

                // Best-effort removal of the previous image (never blocks success).
                if (!string.IsNullOrEmpty(oldPath) && oldPath != s3Path)
                    await SafeDeleteAsync(oldPath);

                var imageUrl = BuildImageUrl(s3Path);
                return Ok(new
                {
                    isSuccess = true,
                    message = "Profile image updated successfully.",
                    response = new { imageUrl, s3Path }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { isSuccess = false, message = $"Error uploading image: {ex.Message}" });
            }
        }

        /// <summary>Removes the logged-in user's profile image (from S3 and the app-user row).</summary>
        [HttpDelete("DeleteProfileImage")]
        public async Task<IActionResult> DeleteProfileImage()
        {
            var userId = GetCurrentUserId();
            if (userId is null)
                return Unauthorized(new { isSuccess = false, message = "Could not identify the current user." });

            var existing = await _userManagementService.GetMyProfileAsync(userId.Value);
            var path = existing.IsSuccess ? existing.Response?.ProfileImagePath : null;

            // Clear the DB reference first; the S3 delete is best-effort cleanup.
            var saveResult = await _userManagementService.UpdateProfileImageAsync(userId.Value, null);
            if (!saveResult.IsSuccess)
                return Ok(saveResult);

            if (!string.IsNullOrEmpty(path))
                await SafeDeleteAsync(path);

            return Ok(new { isSuccess = true, message = "Profile image removed." });
        }

        /// <summary>Turns a stored S3 key into a short-lived pre-signed URL (null when no image).</summary>
        private string? BuildImageUrl(string? s3Path)
            => string.IsNullOrEmpty(s3Path) ? null : _s3StorageService.GetPreSignedUrl(s3Path, 60);

        /// <summary>Deletes an S3 object, swallowing failures (orphan cleanup must never break the request).</summary>
        private async Task SafeDeleteAsync(string s3Path)
        {
            try { await _s3StorageService.DeleteFileAsync(s3Path); }
            catch { /* best-effort */ }
        }

        /// <summary>Resolves the acting user's WebAppUser primary key from the JWT "UserId" claim.</summary>
        private int? GetCurrentUserId()
            => int.TryParse(User.FindFirst("UserId")?.Value, out var id) && id > 0
                ? id
                : (int?)null;

        private int GetCurrentCustomerId()

        {
            var headerValue = HttpContext.Request.Headers["CustomerId"].ToString();
            if (!string.IsNullOrEmpty(headerValue) && int.TryParse(headerValue, out var headerCustomerId) && headerCustomerId > 0)
                return headerCustomerId;

            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (int.TryParse(customerIdClaim, out var customerId) && customerId > 0)
                return customerId;

            return _tenantProvider.GetCustomerId() ?? 0;
        }

        /// <summary>
        /// Reads the JWT "RoleType" claim issued by AuthService. The claim is set to
        /// "SuperAdmin" when the user has IsSuperAdmin=true (or the legacy CustomerId IS NULL).
        /// Used to gate any payload that mutates the IsSuperAdmin flag.
        /// </summary>
        private bool IsCallerSuperAdmin()
            => string.Equals(User.FindFirst("RoleType")?.Value, "SuperAdmin", StringComparison.OrdinalIgnoreCase);
    }
}
