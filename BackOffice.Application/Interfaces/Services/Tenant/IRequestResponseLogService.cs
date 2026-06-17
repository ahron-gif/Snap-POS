using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Logs;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IRequestResponseLogService
    {
        /// <summary>
        /// Get all request logs with pagination, filtering, and sorting support
        /// </summary>
        ApiResponse<PaginationResponseDTO<RequestLogGridDto>> GetAllRequestLogsGrid(PaginationGridDto paginationGridDto);

        /// <summary>
        /// Get all response logs with pagination, filtering, and sorting support
        /// </summary>
        ApiResponse<PaginationResponseDTO<ResponseLogGridDto>> GetAllResponseLogsGrid(PaginationGridDto paginationGridDto);

        /// <summary>
        /// Get combined request/response logs with pagination, filtering, and sorting support
        /// </summary>
        ApiResponse<PaginationResponseDTO<RequestResponseLogDto>> GetAllRequestResponseLogsGrid(PaginationGridDto paginationGridDto);

        /// <summary>
        /// Get request log by ID with linked response
        /// </summary>
        Task<ApiResponse<RequestLogDetailDto>> GetRequestLogByIdAsync(int requestId);

        /// <summary>
        /// Get response log by request ID
        /// </summary>
        Task<ApiResponse<ResponseLogGridDto>> GetResponseByRequestIdAsync(int requestId);

        /// <summary>
        /// Get distinct controller names for filter dropdown
        /// </summary>
        Task<ApiResponse<List<string>>> GetDistinctControllerNamesAsync();

        /// <summary>
        /// Get distinct method names for filter dropdown
        /// </summary>
        Task<ApiResponse<List<string>>> GetDistinctMethodNamesAsync(string? controllerName = null);
    }
}
