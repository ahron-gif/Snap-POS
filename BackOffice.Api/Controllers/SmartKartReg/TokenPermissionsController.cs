using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.TokenPermission;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers.SmartKartReg
{
    [Route("api/token-permissions")]
    [ApiController]
    [Authorize]
    public class TokenPermissionsController : ControllerBase
    {
        private readonly ITokenPermissionService _tokenPermissionService;

        public TokenPermissionsController(ITokenPermissionService tokenPermissionService)
        {
            _tokenPermissionService = tokenPermissionService;
        }

        /// <summary>
        /// Get all token-permission mappings with pagination, filtering, and sorting
        /// </summary>
        [HttpGet]
        public IActionResult GetAllTokenPermissions([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _tokenPermissionService.GetAllTokenPermissionsGrid(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get token-permission mapping by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetTokenPermission(int id)
        {
            var result = await _tokenPermissionService.GetTokenPermissionByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new token-permission mapping
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateTokenPermission([FromBody] CreateTokenPermissionDto dto)
        {
            var createdBy = GetUserNameFromClaims();
            var result = await _tokenPermissionService.CreateTokenPermissionAsync(dto, createdBy);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing token-permission mapping
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTokenPermission(int id, [FromBody] UpdateTokenPermissionDto dto)
        {
            if (id != dto.Id)
            {
                return BadRequest("ID mismatch");
            }

            var modifiedBy = GetUserNameFromClaims();
            var result = await _tokenPermissionService.UpdateTokenPermissionAsync(dto, modifiedBy);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete a token-permission mapping
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTokenPermission(int id)
        {
            var result = await _tokenPermissionService.DeleteTokenPermissionAsync(id);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        private string GetUserNameFromClaims()
        {
            return User.FindFirst("userId")?.Value
                   ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                   ?? "System";
        }
    }
}
