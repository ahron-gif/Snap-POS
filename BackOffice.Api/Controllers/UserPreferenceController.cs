using BackOffice.Application.DTOs.Tenant.UserPreferences;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Controller for managing user-specific preferences (session state, workspace, etc.)
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UserPreferenceController : ControllerBase
    {
        private readonly IUserPreferenceService _userPreferenceService;

        public UserPreferenceController(IUserPreferenceService userPreferenceService)
        {
            _userPreferenceService = userPreferenceService;
        }

        /// <summary>
        /// Gets a single preference by key for the current user
        /// </summary>
        /// <param name="key">Preference key (e.g., "lastSession", "workspaceState")</param>
        [HttpGet("{key}")]
        public async Task<IActionResult> GetPreference(string key)
        {
            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim == null || !Guid.TryParse(localUserIdClaim.Value, out var userId))
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var result = await _userPreferenceService.GetPreferenceAsync(userId, key);
            return Ok(result);
        }

        /// <summary>
        /// Gets multiple preferences by keys for the current user
        /// </summary>
        /// <param name="keys">Comma-separated preference keys</param>
        [HttpGet]
        public async Task<IActionResult> GetPreferences([FromQuery] string keys)
        {
            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim == null || !Guid.TryParse(localUserIdClaim.Value, out var userId))
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var keyArray = keys?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                           ?? Array.Empty<string>();

            if (keyArray.Length == 0)
            {
                return BadRequest(new { IsSuccess = false, Message = "At least one key is required." });
            }

            var result = await _userPreferenceService.GetPreferencesAsync(userId, keyArray);
            return Ok(result);
        }

        /// <summary>
        /// Saves (upserts) a preference for the current user
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> SavePreference([FromBody] SaveUserPreferenceDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim == null || !Guid.TryParse(localUserIdClaim.Value, out var userId))
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var result = await _userPreferenceService.SavePreferenceAsync(userId, dto);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Deletes a preference by key for the current user
        /// </summary>
        [HttpDelete("{key}")]
        public async Task<IActionResult> DeletePreference(string key)
        {
            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim == null || !Guid.TryParse(localUserIdClaim.Value, out var userId))
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var result = await _userPreferenceService.DeletePreferenceAsync(userId, key);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
    }
}
