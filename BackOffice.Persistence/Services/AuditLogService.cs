#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.AuditLog;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services;

public class AuditLogService : IAuditLogService
{
    private readonly TenantDBContext _tenantDb;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(TenantDBContext tenantDb, ILogger<AuditLogService> logger)
    {
        _tenantDb = tenantDb;
        _logger = logger;
    }

    public ApiResponse<PaginationResponseDTO<AuditLogGridDto>> GetAuditLogs(AuditLogFilterDto filter)
    {
        try
        {
            var filters = new List<PaginationGridFilterDto>();
            if (!string.IsNullOrEmpty(filter.Filters) &&
                CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(filter.Filters))
            {
                filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(filter.Filters);
            }

            var query = _tenantDb.AuditLogs
                .AsNoTracking()
                .Select(a => new AuditLogGridDto
                {
                    Id = a.Id,
                    UserId = a.UserId,
                    Action = a.Action,
                    EntityType = a.EntityType,
                    EntityId = a.EntityId,
                    ChangedFields = a.ChangedFields,
                    CreatedAt = a.CreatedAt
                })
                .AsQueryable();

            if (!string.IsNullOrEmpty(filter.EntityType))
                query = query.Where(a => a.EntityType == filter.EntityType);

            if (!string.IsNullOrEmpty(filter.EntityId))
                query = query.Where(a => a.EntityId == filter.EntityId);

            if (!string.IsNullOrEmpty(filter.Action))
                query = query.Where(a => a.Action == filter.Action);

            if (filter.UserId.HasValue)
                query = query.Where(a => a.UserId == filter.UserId.Value);

            if (filter.FromDate.HasValue)
                query = query.Where(a => a.CreatedAt >= filter.FromDate.Value);

            if (filter.ToDate.HasValue)
                query = query.Where(a => a.CreatedAt <= filter.ToDate.Value);

            query = QueryHelper.ApplyFilters(query, filters, filter.CustomGridSearchText, filter.CustomGridSearchColumns);

            var totalRecords = _tenantDb.AuditLogs.Count();
            var filteredRecords = query.Count();

            query = SortHelper.ApplySorting(query, filter.SortColumn ?? "CreatedAt", filter.SortDirection ?? "desc");

            var pageSize = Math.Max(filter.EndRow - filter.StartRow, 1);
            var paginatedData = query
                .Skip(filter.StartRow)
                .Take(pageSize)
                .ToList();

            return ApiResponseFactory.Success(new PaginationResponseDTO<AuditLogGridDto>
            {
                Data = paginatedData,
                TotalRecords = totalRecords,
                RecordsFiltered = filteredRecords,
                CurrentPage = filter.StartRow / pageSize,
                PageSize = pageSize
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching audit logs");
            return ApiResponseFactory.InternalError<PaginationResponseDTO<AuditLogGridDto>>(
                "Error fetching audit logs.", new List<string> { ex.Message });
        }
    }

    public async Task<ApiResponse<AuditLogDetailDto>> GetAuditLogByIdAsync(long id)
    {
        try
        {
            var entity = await _tenantDb.AuditLogs
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == id);

            if (entity is null)
                return ApiResponseFactory.NotFound<AuditLogDetailDto>("Audit log entry not found.");

            var dto = new AuditLogDetailDto
            {
                Id = entity.Id,
                UserId = entity.UserId,
                Action = entity.Action,
                EntityType = entity.EntityType,
                EntityId = entity.EntityId,
                OldValue = entity.OldValue,
                NewValue = entity.NewValue,
                ChangedFields = entity.ChangedFields,
                IpAddress = entity.IpAddress,
                CreatedAt = entity.CreatedAt
            };

            return ApiResponseFactory.Success(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching audit log {Id}", id);
            return ApiResponseFactory.InternalError<AuditLogDetailDto>(ex.Message);
        }
    }

    public async Task<ApiResponse<List<AuditLogGridDto>>> GetEntityHistoryAsync(string entityType, string entityId)
    {
        try
        {
            var entries = await _tenantDb.AuditLogs
                .AsNoTracking()
                .Where(a => a.EntityType == entityType && a.EntityId == entityId)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new AuditLogGridDto
                {
                    Id = a.Id,
                    UserId = a.UserId,
                    Action = a.Action,
                    EntityType = a.EntityType,
                    EntityId = a.EntityId,
                    ChangedFields = a.ChangedFields,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            return ApiResponseFactory.Success(entries);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching entity history for {EntityType}/{EntityId}", entityType, entityId);
            return ApiResponseFactory.InternalError<List<AuditLogGridDto>>(ex.Message);
        }
    }
}
