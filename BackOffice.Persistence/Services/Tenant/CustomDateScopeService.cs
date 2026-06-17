using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Reports;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// CRUD for tenant-defined named date-range presets used by the Reports
    /// "More" date scope dropdown. Soft-delete via IsActive=false.
    /// </summary>
    public class CustomDateScopeService : ICustomDateScopeService
    {
        private readonly TenantDBContext _dbContext;

        public CustomDateScopeService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<CustomDateScopeDto>> GetPagedAsync(PaginationGridDto grid)
        {
            try
            {
                var filters = new List<PaginationGridFilterDto>();
                if (!string.IsNullOrEmpty(grid.Filters) &&
                    CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(grid.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(grid.Filters)
                              ?? new List<PaginationGridFilterDto>();
                }

                // Soft-deleted rows (IsActive=false) must not appear in the list —
                // otherwise the user thinks delete didn't work because the row is
                // still visible after a successful soft-delete.
                var query = _dbContext.CustomDateScopes
                    .Where(x => x.IsActive)
                    .Select(x => new CustomDateScopeDto
                    {
                        CustomDateScopeID = x.CustomDateScopeID,
                        Name = x.Name,
                        Description = x.Description,
                        FromDate = x.FromDate,
                        ToDate = x.ToDate,
                        SortColumn = x.SortColumn,
                        SortDirection = x.SortDirection,
                        SortOrder = x.SortOrder,
                        IsActive = x.IsActive,
                        CreatedAt = x.CreatedAt,
                        ModifiedAt = x.ModifiedAt,
                    })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, grid.CustomGridSearchText, grid.CustomGridSearchColumns);

                var totalRecords = _dbContext.CustomDateScopes.Where(x => x.IsActive).Count();
                var filteredRecords = query.Count();

                // Default sort is by manual SortOrder ascending so the list
                // matches the order the user maintains via the form's
                // SortOrder dropdown. Caller-supplied sort still wins.
                query = SortHelper.ApplySorting(query, grid.SortColumn ?? "SortOrder", grid.SortDirection ?? "asc");

                var page = query
                    .Skip(grid.StartRow)
                    .Take(grid.EndRow - grid.StartRow)
                    .ToList();

                var resp = new PaginationResponseDTO<CustomDateScopeDto>
                {
                    Filters = grid.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = grid.StartRow > 0
                        ? (int)Math.Ceiling((double)grid.EndRow / Math.Max(1, grid.EndRow - grid.StartRow))
                        : 1,
                    PageSize = grid.EndRow - grid.StartRow,
                    Data = page,
                };

                return ApiResponseFactory.Success(resp, "Custom date scopes retrieved.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<CustomDateScopeDto>>(
                    "Error fetching custom date scopes.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<CustomDateScopeDto>>> GetActiveAsync()
        {
            try
            {
                // Order by SortOrder ascending so the More dropdown reflects the
                // user's manual ordering, not alphabetical.
                var rows = await _dbContext.CustomDateScopes
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.SortOrder)
                    .ThenBy(x => x.Name)
                    .Select(x => new CustomDateScopeDto
                    {
                        CustomDateScopeID = x.CustomDateScopeID,
                        Name = x.Name,
                        Description = x.Description,
                        FromDate = x.FromDate,
                        ToDate = x.ToDate,
                        SortColumn = x.SortColumn,
                        SortDirection = x.SortDirection,
                        SortOrder = x.SortOrder,
                        IsActive = x.IsActive,
                        CreatedAt = x.CreatedAt,
                        ModifiedAt = x.ModifiedAt,
                    })
                    .ToListAsync();

                return ApiResponseFactory.Success(rows, "Active custom date scopes retrieved.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<CustomDateScopeDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<CustomDateScopeDto>> GetByIdAsync(Guid id)
        {
            try
            {
                // Hide soft-deleted rows from edit lookups — same reason as in
                // GetPagedAsync: returning them would let the form re-edit a
                // logically-deleted scope.
                var row = await _dbContext.CustomDateScopes
                    .Where(x => x.CustomDateScopeID == id && x.IsActive)
                    .Select(x => new CustomDateScopeDto
                    {
                        CustomDateScopeID = x.CustomDateScopeID,
                        Name = x.Name,
                        Description = x.Description,
                        FromDate = x.FromDate,
                        ToDate = x.ToDate,
                        SortColumn = x.SortColumn,
                        SortDirection = x.SortDirection,
                        SortOrder = x.SortOrder,
                        IsActive = x.IsActive,
                        CreatedAt = x.CreatedAt,
                        ModifiedAt = x.ModifiedAt,
                    })
                    .FirstOrDefaultAsync();

                if (row == null)
                    return ApiResponseFactory.NotFound<CustomDateScopeDto>("Custom date scope not found.");

                return ApiResponseFactory.Success(row, "Custom date scope retrieved.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<CustomDateScopeDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<Guid>> CreateAsync(CreateCustomDateScopeDto dto, Guid userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Name))
                    return ApiResponseFactory.BadRequest<Guid>("Name is required.");
                if (dto.FromDate > dto.ToDate)
                    return ApiResponseFactory.BadRequest<Guid>("FromDate must be on or before ToDate.");

                // Active-name uniqueness check (matches the unique filtered index).
                if (dto.IsActive)
                {
                    var dup = await _dbContext.CustomDateScopes
                        .AnyAsync(x => x.IsActive && x.Name == dto.Name);
                    if (dup)
                        return ApiResponseFactory.BadRequest<Guid>("A scope with this name already exists.");
                }

                // Auto-assign SortOrder = max(active) + 1 so new scopes always
                // land at the bottom of the list.
                var nextOrder = (await _dbContext.CustomDateScopes
                    .Where(x => x.IsActive)
                    .Select(x => (int?)x.SortOrder)
                    .MaxAsync()) ?? 0;
                nextOrder += 1;

                var entity = new CustomDateScope
                {
                    CustomDateScopeID = Guid.NewGuid(),
                    Name = dto.Name.Trim(),
                    Description = dto.Description,
                    FromDate = dto.FromDate.Date,
                    ToDate = dto.ToDate.Date,
                    SortOrder = nextOrder,
                    IsActive = dto.IsActive,
                    CreatedBy = userId == Guid.Empty ? null : userId,
                    CreatedAt = DateTime.UtcNow,
                };

                _dbContext.CustomDateScopes.Add(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.CustomDateScopeID, "Custom date scope created.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<Guid>(ex.Message);
            }
        }

        /// <summary>
        /// Re-position `target` to `newOrder`, shifting other active rows so
        /// the active set remains a contiguous 1..N sequence with no gaps or
        /// duplicates. Caller is responsible for the surrounding transaction
        /// and SaveChangesAsync.
        /// </summary>
        private async System.Threading.Tasks.Task ReorderAsync(CustomDateScope target, int newOrder)
        {
            // Clamp to the valid range so a misbehaving client can't push a
            // scope past the end of the list.
            var maxOrder = await _dbContext.CustomDateScopes
                .Where(x => x.IsActive)
                .Select(x => (int?)x.SortOrder)
                .MaxAsync() ?? 0;
            if (maxOrder < 1) maxOrder = 1;
            newOrder = Math.Max(1, Math.Min(newOrder, maxOrder));

            var oldOrder = target.SortOrder;
            if (oldOrder == newOrder) return;

            if (newOrder < oldOrder)
            {
                // Moving the scope UP the list: rows in [newOrder, oldOrder-1] shift +1.
                var affected = await _dbContext.CustomDateScopes
                    .Where(x => x.IsActive
                                && x.SortOrder >= newOrder
                                && x.SortOrder < oldOrder
                                && x.CustomDateScopeID != target.CustomDateScopeID)
                    .ToListAsync();
                foreach (var row in affected) row.SortOrder += 1;
            }
            else
            {
                // Moving DOWN: rows in [oldOrder+1, newOrder] shift -1.
                var affected = await _dbContext.CustomDateScopes
                    .Where(x => x.IsActive
                                && x.SortOrder > oldOrder
                                && x.SortOrder <= newOrder
                                && x.CustomDateScopeID != target.CustomDateScopeID)
                    .ToListAsync();
                foreach (var row in affected) row.SortOrder -= 1;
            }

            target.SortOrder = newOrder;
        }

        public async Task<ApiResponse<bool>> UpdateAsync(Guid id, UpdateCustomDateScopeDto dto, Guid userId)
        {
            try
            {
                var entity = await _dbContext.CustomDateScopes
                    .FirstOrDefaultAsync(x => x.CustomDateScopeID == id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Custom date scope not found.");

                if (string.IsNullOrWhiteSpace(dto.Name))
                    return ApiResponseFactory.BadRequest<bool>("Name is required.");
                if (dto.FromDate > dto.ToDate)
                    return ApiResponseFactory.BadRequest<bool>("FromDate must be on or before ToDate.");

                if (dto.IsActive)
                {
                    var dup = await _dbContext.CustomDateScopes
                        .AnyAsync(x => x.IsActive && x.Name == dto.Name && x.CustomDateScopeID != id);
                    if (dup)
                        return ApiResponseFactory.BadRequest<bool>("A scope with this name already exists.");
                }

                // The DbContext is configured with EnableRetryOnFailure(), so
                // we must run user-initiated transactions through the
                // execution strategy — otherwise EF throws
                // "SqlServerRetryingExecutionStrategy does not support
                // user-initiated transactions". The strategy may invoke this
                // delegate more than once on transient failure.
                var strategy = _dbContext.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    using var tx = await _dbContext.Database.BeginTransactionAsync();

                    // Reorder first so neighbour shifts happen before the
                    // entity's SortOrder is overwritten.
                    if (dto.SortOrder.HasValue && entity.IsActive && dto.SortOrder.Value != entity.SortOrder)
                    {
                        await ReorderAsync(entity, dto.SortOrder.Value);
                    }

                    entity.Name = dto.Name.Trim();
                    entity.Description = dto.Description;
                    entity.FromDate = dto.FromDate.Date;
                    entity.ToDate = dto.ToDate.Date;
                    entity.IsActive = dto.IsActive;
                    entity.ModifiedBy = userId == Guid.Empty ? null : userId;
                    entity.ModifiedAt = DateTime.UtcNow;

                    await _dbContext.SaveChangesAsync();
                    await tx.CommitAsync();
                });

                return ApiResponseFactory.Success(true, "Custom date scope updated.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> DeleteAsync(Guid id, Guid userId)
        {
            try
            {
                var entity = await _dbContext.CustomDateScopes
                    .FirstOrDefaultAsync(x => x.CustomDateScopeID == id && x.IsActive);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Custom date scope not found.");

                // Run through the execution strategy so the retry-enabled
                // DbContext can handle transient failures. Manually starting
                // a transaction outside the strategy throws.
                var strategy = _dbContext.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    using var tx = await _dbContext.Database.BeginTransactionAsync();

                    var deletedOrder = entity.SortOrder;

                    entity.IsActive = false;
                    entity.ModifiedBy = userId == Guid.Empty ? null : userId;
                    entity.ModifiedAt = DateTime.UtcNow;

                    // Compact remaining active rows so the list stays 1..N
                    // contiguous: every row with SortOrder > deletedOrder
                    // shifts down by one.
                    var toShift = await _dbContext.CustomDateScopes
                        .Where(x => x.IsActive
                                    && x.SortOrder > deletedOrder
                                    && x.CustomDateScopeID != entity.CustomDateScopeID)
                        .ToListAsync();
                    foreach (var row in toShift) row.SortOrder -= 1;

                    await _dbContext.SaveChangesAsync();
                    await tx.CommitAsync();
                });

                return ApiResponseFactory.Success(true, "Custom date scope deleted.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<int>> BulkDeleteAsync(List<Guid> ids, Guid userId)
        {
            try
            {
                if (ids == null || ids.Count == 0)
                    return ApiResponseFactory.BadRequest<int>("No scopes selected.");

                // Pull only the still-active rows in the requested set. Any
                // already-inactive ids are silently skipped — the caller's
                // selection set may be stale but that's not an error.
                var entities = await _dbContext.CustomDateScopes
                    .Where(x => ids.Contains(x.CustomDateScopeID) && x.IsActive)
                    .ToListAsync();

                if (entities.Count == 0)
                    return ApiResponseFactory.Success(0, "No active scopes to delete.");

                var deletedCount = 0;

                // Wrap through the execution strategy so the configured
                // SqlServerRetryingExecutionStrategy can safely retry the
                // entire bulk delete + compaction as a unit.
                var strategy = _dbContext.Database.CreateExecutionStrategy();
                await strategy.ExecuteAsync(async () =>
                {
                    using var tx = await _dbContext.Database.BeginTransactionAsync();

                    var now = DateTime.UtcNow;
                    var modifiedBy = userId == Guid.Empty ? (Guid?)null : userId;

                    foreach (var entity in entities)
                    {
                        entity.IsActive = false;
                        entity.ModifiedBy = modifiedBy;
                        entity.ModifiedAt = now;
                    }
                    deletedCount = entities.Count;

                    // After the soft delete, re-number the surviving active
                    // rows from 1..N in their current SortOrder order. This
                    // collapses the gaps in one shot rather than running the
                    // single-row "shift everything > deletedOrder" logic
                    // repeatedly (which would be O(n*m) and fight itself).
                    var deletedIds = entities
                        .Select(e => e.CustomDateScopeID)
                        .ToList();
                    var survivors = await _dbContext.CustomDateScopes
                        .Where(x => x.IsActive && !deletedIds.Contains(x.CustomDateScopeID))
                        .OrderBy(x => x.SortOrder)
                        .ThenBy(x => x.CreatedAt)
                        .ToListAsync();

                    var rank = 1;
                    foreach (var row in survivors)
                    {
                        if (row.SortOrder != rank) row.SortOrder = rank;
                        rank++;
                    }

                    await _dbContext.SaveChangesAsync();
                    await tx.CommitAsync();
                });

                return ApiResponseFactory.Success(
                    deletedCount,
                    $"{deletedCount} custom date scope(s) deleted.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<int>(ex.Message);
            }
        }
    }
}
