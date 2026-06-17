using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PermissionRegistryController : ControllerBase
    {
        private readonly IPermissionRegistryService _service;

        public PermissionRegistryController(IPermissionRegistryService service)
        {
            _service = service;
        }

        [HttpGet("Modules/Tree")]
        public async Task<IActionResult> GetModuleTree()
        {
            var result = await _service.GetModuleTreeAsync();
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Get module by name (e.g. from header); returns ModuleId for use when saving a screen. Route is ModuleByName to avoid conflict with Modules/.</summary>
        [HttpGet("ModuleByName")]
        public async Task<IActionResult> GetModuleByName([FromQuery] string name)
        {
            var result = await _service.GetModuleByNameAsync(name ?? "");
            return Ok(result);
        }

        [HttpGet("Screens/Module/{moduleId}")]
        public async Task<IActionResult> GetScreensByModule(int moduleId)
        {
            var result = await _service.GetScreensByModuleAsync(moduleId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("Permissions/Screen/{screenId}")]
        public async Task<IActionResult> GetPermissionsByScreen(int screenId)
        {
            var result = await _service.GetPermissionsByScreenAsync(screenId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("Permissions")]
        public async Task<IActionResult> GetAllPermissions()
        {
            var result = await _service.GetAllPermissionsAsync();
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("Screens")]
        public async Task<IActionResult> CreateScreen([FromBody] CreateScreenDto dto)
        {
            var result = await _service.CreateScreenAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Screens/{id}")]
        public async Task<IActionResult> UpdateScreen(int id, [FromBody] UpdateScreenDto dto)
        {
            if (id != dto.Id)
                return BadRequest("ID mismatch");

            var result = await _service.UpdateScreenAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("Permissions")]
        public async Task<IActionResult> CreatePermission([FromBody] CreatePermissionDto dto)
        {
            var result = await _service.CreatePermissionAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Permissions/{id}")]
        public async Task<IActionResult> UpdatePermission(int id, [FromBody] UpdatePermissionDto dto)
        {
            if (id != dto.Id)
                return BadRequest("ID mismatch");

            var result = await _service.UpdatePermissionAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("Seed")]
        public async Task<IActionResult> SeedPermissions()
        {
            await _service.SeedPermissionsAsync();
            return Ok();
        }

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }
    }
}
