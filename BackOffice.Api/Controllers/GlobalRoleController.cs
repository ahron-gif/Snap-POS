using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Main.RoleManagement;
using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GlobalRoleController : ControllerBase
    {
        private readonly IGlobalRoleService _globalRoleService;

        public GlobalRoleController(IGlobalRoleService globalRoleService)
        {
            _globalRoleService = globalRoleService;
        }

        [HttpGet("ScreenActions")]
        public IActionResult GetScreenActionsGrid([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _globalRoleService.GetScreenActionsGrid(paginationGridDto);
            return Ok(result);
        }

        [HttpGet("ScreenActions/Grouped")]
        public async Task<IActionResult> GetScreenActionsGrouped()
        {
            var result = await _globalRoleService.GetScreenActionsGroupedAsync();
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("ScreenActions/Module/{moduleId}")]
        public async Task<IActionResult> GetScreenActionsByModule(int moduleId)
        {
            var result = await _globalRoleService.GetScreenActionsByModuleAsync(moduleId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("ScreenActions")]
        public async Task<IActionResult> CreateScreenAction([FromBody] CreateScreenActionDto dto)
        {
            var result = await _globalRoleService.CreateScreenActionAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("ScreenActions/{id}")]
        public async Task<IActionResult> UpdateScreenAction(int id, [FromBody] UpdateScreenActionDto dto)
        {
            if (id != dto.ScreenActionId)
                return BadRequest("ID mismatch");

            var result = await _globalRoleService.UpdateScreenActionAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("ScreenActions/{id}")]
        public async Task<IActionResult> DeleteScreenAction(int id)
        {
            var result = await _globalRoleService.DeleteScreenActionAsync(id);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("Roles")]
        public IActionResult GetRoles([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _globalRoleService.GetRolesGrid(paginationGridDto);
            return Ok(result);
        }

        [HttpGet("Roles/{id}")]
        public async Task<IActionResult> GetRole(int id)
        {
            var result = await _globalRoleService.GetRoleByIdAsync(id);
            if (!result.IsSuccess)
                return NotFound(result);
            return Ok(result);
        }

        [HttpPost("Roles")]
        public async Task<IActionResult> CreateRole([FromBody] CreateGlobalRoleDto dto)
        {
            var createdBy = GetUserIdFromClaims();
            var result = await _globalRoleService.CreateRoleAsync(dto, createdBy);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Roles/{id}")]
        public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateGlobalRoleDto dto)
        {
            if (id != dto.GlobalRoleId)
                return BadRequest("ID mismatch");

            var result = await _globalRoleService.UpdateRoleAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("Roles/{id}")]
        public async Task<IActionResult> DeleteRole(int id)
        {
            var result = await _globalRoleService.DeleteRoleAsync(id);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("Roles/{id}/Permissions")]
        public async Task<IActionResult> GetRolePermissions(int id)
        {
            var result = await _globalRoleService.GetRolePermissionsAsync(id);
            if (!result.IsSuccess)
                return NotFound(result);
            return Ok(result);
        }

        [HttpPut("Roles/{id}/Permissions")]
        public async Task<IActionResult> UpdateRolePermissions(int id, [FromBody] BulkPermissionUpdateDto dto)
        {
            var result = await _globalRoleService.BulkUpdateRolePermissionsAsync(id, dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("CustomerRoles/{customerId}")]
        public async Task<IActionResult> GetCustomerRoles(int customerId)
        {
            var result = await _globalRoleService.GetCustomerRoleIdsAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("CustomerRoles")]
        public async Task<IActionResult> AssignCustomerRoles([FromBody] CustomerRoleAssignmentDto dto)
        {
            var assignedBy = GetUserIdFromClaims();
            var result = await _globalRoleService.AssignRolesToCustomerAsync(dto, assignedBy);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("UserRoles/{userId}")]
        public async Task<IActionResult> GetUserRoles(int userId)
        {
            var result = await _globalRoleService.GetUserRoleIdsAsync(userId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("UserRoles")]
        public async Task<IActionResult> AssignUserRoles([FromBody] AppUserRoleAssignmentDto dto)
        {
            var assignedBy = GetUserIdFromClaims();
            var result = await _globalRoleService.AssignRolesToUserAsync(dto, assignedBy);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }
    }
}
