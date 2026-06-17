using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.StoreToken;
using BackOffice.Application.DTOs.SmartKartReg.TokenPermission;
using BackOffice.Application.DTOs.SmartKartReg.TokenStoreAccess;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers.SmartKartReg
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TokensController : ControllerBase
    {
        private readonly IStoreTokenService _storeTokenService;

        public TokensController(IStoreTokenService storeTokenService)
        {
            _storeTokenService = storeTokenService;
        }

        /// <summary>
        /// Get all tokens with pagination, filtering, and sorting
        /// </summary>
        [HttpGet]
        public IActionResult GetAllTokens([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _storeTokenService.GetAllTokensGrid(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Get lightweight token list for dropdowns (Id, StoreApp, StoreName, Active)
        /// </summary>
        [HttpGet("dropdown")]
        public async Task<IActionResult> GetTokensDropdown()
        {
            var result = await _storeTokenService.GetTokensDropdownAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get token by ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetToken(int id)
        {
            var result = await _storeTokenService.GetTokenByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Create a new token
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateToken([FromBody] CreateStoreTokenDto dto)
        {
            var createdBy = GetUserNameFromClaims();
            var result = await _storeTokenService.CreateTokenAsync(dto, createdBy);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Update an existing token
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateToken(int id, [FromBody] UpdateStoreTokenDto dto)
        {
            if (id != dto.Id)
            {
                return BadRequest("ID mismatch");
            }

            var modifiedBy = GetUserNameFromClaims();
            var result = await _storeTokenService.UpdateTokenAsync(dto, modifiedBy);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Delete a token
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteToken(int id)
        {
            var result = await _storeTokenService.DeleteTokenAsync(id);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Get all permissions assigned to a specific token
        /// </summary>
        [HttpGet("{tokenId}/permissions")]
        public async Task<IActionResult> GetTokenPermissions(int tokenId)
        {
            var result = await _storeTokenService.GetTokenPermissionsAsync(tokenId);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Bulk update permissions for a token (allow/deny). Creates new mappings or updates existing ones.
        /// </summary>
        [HttpPut("{tokenId}/permissions/bulk")]
        public async Task<IActionResult> BulkUpdateTokenPermissions(int tokenId, [FromBody] BulkTokenPermissionUpdateDto dto)
        {
            var modifiedBy = GetUserNameFromClaims();
            var result = await _storeTokenService.BulkUpdateTokenPermissionsAsync(tokenId, dto, modifiedBy);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        // ==================== Token Store Access ====================

        /// <summary>
        /// Get all stores dropdown list (RegistrationId, StoreName)
        /// </summary>
        [HttpGet("stores-dropdown")]
        public async Task<IActionResult> GetStoresDropdown()
        {
            var result = await _storeTokenService.GetStoresDropdownAsync();
            return Ok(result);
        }

        [HttpGet("{tokenId}/tenant-stores")]
        public async Task<IActionResult> GetStoresByToken(int tokenId)
        {
            var result = await _storeTokenService.GetStoresByTokenAsync(tokenId);
            if (!result.IsSuccess)
            {
                return result.StatusCode == BackOffice.Common.ResponseCode.NotFoundError ? NotFound(result) : BadRequest(result);
            }
            return Ok(result);
        }

        [HttpGet("{tokenId}/store-access")]
        public async Task<IActionResult> GetTokenStoreAccess(int tokenId)
        {
            var result = await _storeTokenService.GetTokenStoreAccessAsync(tokenId);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Bulk update store access for a token. Syncs the store list — adds new, removes missing.
        /// </summary>
        [HttpPut("{tokenId}/store-access/bulk")]
        public async Task<IActionResult> BulkUpdateTokenStoreAccess(int tokenId, [FromBody] BulkTokenStoreAccessDto dto)
        {
            var modifiedBy = GetUserNameFromClaims();
            var result = await _storeTokenService.BulkUpdateTokenStoreAccessAsync(tokenId, dto, modifiedBy);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Remove a single store access mapping by ID
        /// </summary>
        [HttpDelete("store-access/{id}")]
        public async Task<IActionResult> RemoveTokenStoreAccess(int id)
        {
            var result = await _storeTokenService.RemoveTokenStoreAccessAsync(id);
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
