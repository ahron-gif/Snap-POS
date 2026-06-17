using BackOffice.Application.DTOs.AuditLog;
using BackOffice.Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AuditLogController : ControllerBase
    {
        private readonly IAuditLogService _auditLogService;

        public AuditLogController(IAuditLogService auditLogService)
        {
            _auditLogService = auditLogService;
        }

        [HttpGet("GetAll")]
        public IActionResult GetAll([FromQuery] AuditLogFilterDto filter)
        {
            var result = _auditLogService.GetAuditLogs(filter);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(long id)
        {
            var result = await _auditLogService.GetAuditLogByIdAsync(id);

            if (!result.IsSuccess)
            
                return NotFound(result);

            return Ok(result);
        }
    
        [HttpGet("EntityHistory")]
        public async Task<IActionResult> GetEntityHistory([FromQuery] string entityType, [FromQuery] string entityId)
        {
            var result = await _auditLogService.GetEntityHistoryAsync(entityType, entityId);
            return Ok(result);
        }
    }
}
