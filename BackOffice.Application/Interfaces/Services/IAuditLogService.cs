#nullable enable
using System.Collections.Generic;
using System.Threading.Tasks;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.AuditLog;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services;

public interface IAuditLogService
{
    ApiResponse<PaginationResponseDTO<AuditLogGridDto>> GetAuditLogs(AuditLogFilterDto filter);
    Task<ApiResponse<AuditLogDetailDto>> GetAuditLogByIdAsync(long id);
    Task<ApiResponse<List<AuditLogGridDto>>> GetEntityHistoryAsync(string entityType, string entityId);
}
