using BackOffice.Application.DTOs.Tenant.GridSettings;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Controller for managing user-specific grid column settings
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GridSettingsController : ControllerBase
    {
        private readonly IGridSettingsService _gridSettingsService;

        public GridSettingsController(IGridSettingsService gridSettingsService)
        {
            _gridSettingsService = gridSettingsService;
        }

        /// <summary>
        /// Gets grid settings for the current user and specified grid
        /// </summary>
        /// <param name="gridId">Grid identifier</param>
        /// <returns>Grid settings or null if not found</returns>
        [HttpGet("{gridId}")]
        public async Task<IActionResult> GetGridSettings(string gridId)
        {
            // Get LocalUserId (Guid) from claims - this is the tenant-specific user ID
            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim == null || !Guid.TryParse(localUserIdClaim.Value, out var userId))
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var result = await _gridSettingsService.GetGridSettingsAsync(userId, gridId);
            return Ok(result);
        }

        /// <summary>
        /// Saves grid settings for the current user
        /// </summary>
        /// <param name="settings">Grid settings to save</param>
        /// <returns>Success result</returns>
        [HttpPost]
        public async Task<IActionResult> SaveGridSettings([FromBody] SaveGridSettingsDto settings)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Get LocalUserId (Guid) from claims - this is the tenant-specific user ID
            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim == null || !Guid.TryParse(localUserIdClaim.Value, out var userId))
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var result = await _gridSettingsService.SaveGridSettingsAsync(userId, settings);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Deletes grid settings for the current user and specified grid
        /// </summary>
        /// <param name="gridId">Grid identifier</param>
        /// <returns>Success result</returns>
        [HttpDelete("{gridId}")]
        public async Task<IActionResult> DeleteGridSettings(string gridId)
        {
            // Get LocalUserId (Guid) from claims - this is the tenant-specific user ID
            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim == null || !Guid.TryParse(localUserIdClaim.Value, out var userId))
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var result = await _gridSettingsService.DeleteGridSettingsAsync(userId, gridId);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Deletes all grid settings for the current user
        /// </summary>
        /// <returns>Success result</returns>
        [HttpDelete]
        public async Task<IActionResult> DeleteAllGridSettings()
        {
            // Get LocalUserId (Guid) from claims - this is the tenant-specific user ID
            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim == null || !Guid.TryParse(localUserIdClaim.Value, out var userId))
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var result = await _gridSettingsService.DeleteAllGridSettingsAsync(userId);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
    }
}
