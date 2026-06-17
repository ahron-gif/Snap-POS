using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PlanController : ControllerBase
    {
        private readonly IPlanService _planService;

        public PlanController(IPlanService planService)
        {
            _planService = planService;
        }

        [HttpGet]
        public IActionResult GetPlansGrid([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _planService.GetPlansGrid(paginationGridDto);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetPlan(int id)
        {
            var result = await _planService.GetPlanByIdAsync(id);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("Lookup")]
        public async Task<IActionResult> GetAllPlansLookup()
        {
            var result = await _planService.GetAllPlansLookupAsync();
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreatePlan([FromBody] CreatePlanDto dto)
        {
            var result = await _planService.CreatePlanAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePlan(int id, [FromBody] UpdatePlanDto dto)
        {
            if (id != dto.Id)
                return BadRequest("ID mismatch");

            var result = await _planService.UpdatePlanAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePlan(int id)
        {
            var result = await _planService.DeletePlanAsync(id);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("{id}/Modules")]
        public async Task<IActionResult> GetPlanModules(int id)
        {
            var result = await _planService.GetPlanModulesAsync(id);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("{id}/Modules")]
        public async Task<IActionResult> UpdatePlanModules(int id, [FromBody] List<int> moduleIds)
        {
            var result = await _planService.UpdatePlanModulesAsync(id, moduleIds);
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
