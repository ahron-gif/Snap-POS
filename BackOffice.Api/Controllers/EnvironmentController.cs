using BackOffice.Application.DTOs.Environments;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class EnvironmentController : ControllerBase
{
    private readonly IEnvironmentAccessService _envService;

    public EnvironmentController(IEnvironmentAccessService envService)
    {
        _envService = envService;
    }

    // ─── Environments CRUD ────────────────────────────────────────────────────

    /// <summary>Returns all environments (active and inactive).</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _envService.GetAllEnvironmentsAsync();
        return Ok(new ApiResponse<List<EnvironmentDto>>
        {
            IsSuccess = true,
            Response = result
        });
    }

    /// <summary>Returns a single environment by its GUID.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _envService.GetEnvironmentByIdAsync(id);
        if (result == null)
            return NotFound(new ApiResponse<EnvironmentDto> { IsSuccess = false, Message = "Environment not found." });

        return Ok(new ApiResponse<EnvironmentDto> { IsSuccess = true, Response = result });
    }

    /// <summary>Creates a new environment.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEnvironmentDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest(new ApiResponse<EnvironmentDto> { IsSuccess = false, Message = "Name and Code are required." });

        var result = await _envService.CreateEnvironmentAsync(dto);
        return Ok(new ApiResponse<EnvironmentDto> { IsSuccess = true, Response = result, Message = "Environment created." });
    }

    /// <summary>Updates an existing environment.</summary>
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateEnvironmentDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest(new ApiResponse<EnvironmentDto> { IsSuccess = false, Message = "Name and Code are required." });

        var result = await _envService.UpdateEnvironmentAsync(dto);
        if (result == null)
            return NotFound(new ApiResponse<EnvironmentDto> { IsSuccess = false, Message = "Environment not found." });

        return Ok(new ApiResponse<EnvironmentDto> { IsSuccess = true, Response = result, Message = "Environment updated." });
    }

    /// <summary>
    /// Deletes an environment. Fails if it has active user assignments.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var success = await _envService.DeleteEnvironmentAsync(id);
        if (!success)
            return BadRequest(new ApiResponse<bool>
            {
                IsSuccess = false,
                Message = "Environment not found or is currently assigned to one or more users."
            });

        return Ok(new ApiResponse<bool> { IsSuccess = true, Response = true, Message = "Environment deleted." });
    }

    // ─── User-Environment Assignments ─────────────────────────────────────────

    /// <summary>
    /// Returns the full environment-access snapshot for a user+customer:
    /// HasWebAccess flag + list of assigned environments.
    /// </summary>
    [HttpGet("user/{userId:int}/customer/{customerId:int}")]
    public async Task<IActionResult> GetUserAccess(int userId, int customerId)
    {
        var result = await _envService.GetUserEnvironmentAccessAsync(userId, customerId);
        return Ok(new ApiResponse<UserEnvironmentAccessDto> { IsSuccess = true, Response = result });
    }

    /// <summary>
    /// Replaces all environment assignments for a user+customer and updates
    /// the HasWebAccess flag in a single atomic operation.
    /// </summary>
    [HttpPost("user-environments")]
    public async Task<IActionResult> SetUserEnvironments([FromBody] SetUserEnvironmentsDto dto)
    {
        if (dto.UserId <= 0 || dto.CustomerId <= 0)
            return BadRequest(new ApiResponse<bool> { IsSuccess = false, Message = "UserId and CustomerId are required." });

        await _envService.SetUserEnvironmentsAsync(dto);
        return Ok(new ApiResponse<bool> { IsSuccess = true, Response = true, Message = "Access settings saved successfully." });
    }
}
