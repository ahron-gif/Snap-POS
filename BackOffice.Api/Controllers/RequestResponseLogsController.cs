using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class RequestResponseLogsController : ControllerBase
    {
        private readonly IRequestResponseLogService _logService;

        public RequestResponseLogsController(IRequestResponseLogService logService)
        {
            _logService = logService;
        }

        /// <summary>
        /// Gets all request logs with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of request logs</returns>
        [HttpGet("requests")]
        public IActionResult GetAllRequestLogs([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _logService.GetAllRequestLogsGrid(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Gets all response logs with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of response logs</returns>
        [HttpGet("responses")]
        public IActionResult GetAllResponseLogs([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _logService.GetAllResponseLogsGrid(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Gets all request/response logs combined with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of combined request/response logs</returns>
        [HttpGet("combined")]
        public IActionResult GetAllRequestResponseLogs([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _logService.GetAllRequestResponseLogsGrid(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Gets a request log by ID with linked response
        /// </summary>
        /// <param name="id">Request ID</param>
        /// <returns>Request log details with linked response</returns>
        [HttpGet("requests/{id}")]
        public async Task<IActionResult> GetRequestLogById(int id)
        {
            var result = await _logService.GetRequestLogByIdAsync(id);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Gets a response log by request ID
        /// </summary>
        /// <param name="requestId">Request ID</param>
        /// <returns>Response log for the given request</returns>
        [HttpGet("responses/by-request/{requestId}")]
        public async Task<IActionResult> GetResponseByRequestId(int requestId)
        {
            var result = await _logService.GetResponseByRequestIdAsync(requestId);
            if (!result.IsSuccess)
            {
                return NotFound(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Gets distinct controller names for filter dropdown
        /// </summary>
        /// <returns>List of distinct controller names</returns>
        [HttpGet("controllers")]
        public async Task<IActionResult> GetDistinctControllerNames()
        {
            var result = await _logService.GetDistinctControllerNamesAsync();
            return Ok(result);
        }

        /// <summary>
        /// Gets distinct method names for filter dropdown
        /// </summary>
        /// <param name="controllerName">Optional controller name to filter methods</param>
        /// <returns>List of distinct method names</returns>
        [HttpGet("methods")]
        public async Task<IActionResult> GetDistinctMethodNames([FromQuery] string? controllerName = null)
        {
            var result = await _logService.GetDistinctMethodNamesAsync(controllerName);
            return Ok(result);
        }
    }
}
