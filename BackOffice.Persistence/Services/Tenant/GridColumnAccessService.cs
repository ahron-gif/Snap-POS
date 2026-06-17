using BackOffice.Application.DTOs.Tenant.GridColumnAccess;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// Service for managing Super-Admin-defined per-user grid column access rules.
    ///
    /// Storage convention:
    ///   - A row with UserId == Guid.Empty represents a tenant-wide default
    ///     (applies to all users in the tenant who don't have a more specific rule).
    ///   - A row with any other UserId is a user-specific override.
    ///   - When computing the effective rules for a user, the tenant defaults
    ///     are overlaid with the user's specific rules (field-level merge).
    /// </summary>
    public class GridColumnAccessService : IGridColumnAccessService
    {
        private readonly TenantDBContext _context;

        /// <summary>
        /// Main (master) DB context. Holds the global, cross-tenant default
        /// column config (DefaultGridColumnAccess) — the baseline beneath the
        /// tenant default and user override.
        /// </summary>
        private readonly MainDBContext _mainDb;

        /// <summary>
        /// Sentinel value used in the UserId column to mark a rule as a
        /// tenant-wide default instead of a per-user override.
        /// </summary>
        public static readonly Guid TenantDefaultUserId = Guid.Empty;

        public GridColumnAccessService(TenantDBContext context, MainDBContext mainDb)
        {
            _context = context;
            _mainDb = mainDb;
        }

        /// <inheritdoc/>
        public async Task<ApiResult<GridColumnAccessResponseDto>> GetForUserAndGridAsync(Guid userId, string gridId)
        {
            try
            {
                var rows = await _context.UserGridColumnAccess
                    .AsNoTracking()
                    .Where(x => x.UserId == userId && x.GridId == gridId)
                    .ToListAsync();

                var response = new GridColumnAccessResponseDto
                {
                    UserId = userId,
                    GridId = gridId,
                    Columns = rows.Select(r => new ColumnAccessItemDto
                    {
                        Field = r.Field,
                        AllowedToView = r.AllowedToView,
                        DisplayName = r.DisplayName,
                        SortOrder = r.SortOrder,
                        Width = r.Width,
                        AggregateType = r.AggregateType
                    }).ToList(),
                    LastModified = rows.Count > 0 ? rows.Max(r => r.DateModified) : (DateTime?)null,
                    ModifiedBy = rows.Count > 0
                        ? rows.OrderByDescending(r => r.DateModified).First().ModifiedBy
                        : null
                };

                return new ApiResult<GridColumnAccessResponseDto>
                {
                    IsSuccess = true,
                    Message = rows.Count > 0
                        ? "Column access rules retrieved."
                        : "No rules found — all columns allowed by default.",
                    Response = response
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<GridColumnAccessResponseDto>
                {
                    IsSuccess = false,
                    Message = $"Error retrieving column access: {ex.Message}",
                    Response = new GridColumnAccessResponseDto
                    {
                        UserId = userId,
                        GridId = gridId,
                        Columns = new List<ColumnAccessItemDto>()
                    }
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<GridColumnAccessResponseDto>> GetEffectiveForUserAsync(Guid userId, string gridId)
        {
            try
            {
                // Pull both the tenant defaults (UserId == Guid.Empty) and the
                // user-specific rules in a single query.
                var rows = await _context.UserGridColumnAccess
                    .AsNoTracking()
                    .Where(x => x.GridId == gridId &&
                                (x.UserId == TenantDefaultUserId || x.UserId == userId))
                    .ToListAsync();

                // Pull the GLOBAL default config from the MAIN database. This is
                // the cross-tenant baseline that sits BENEATH the tenant default
                // — used only for fields the tenant default does not cover.
                var globalRowsList = await _mainDb.DefaultGridColumnAccess
                    .AsNoTracking()
                    .Where(x => x.GridId == gridId)
                    .ToListAsync();

                // Build the effective map.
                //
                // PRECEDENCE RULES:
                //
                // 1. CEILING — AllowedToView from the tenant default is a
                //    hard limit. If tenant says false, no user override can
                //    flip it to true. Enforces "Super Admin assigns specific
                //    columns; users can never see anything outside that set".
                //
                // 2. SNAPSHOT — once a user has saved ANY rows for this grid
                //    (hasUserSnapshot = true), their row set IS the snapshot
                //    of their visibility preferences. Fields that EXIST in
                //    the tenant default but are NOT in the user's row set
                //    are treated as hidden — they're tenant-allowed columns
                //    the user hasn't opted into yet. Without this rule, a
                //    Super Admin who later adds new tenant-allowed columns
                //    would automatically reveal them to every existing user,
                //    silently changing the grid layout they've configured.
                //
                //    The chooser still SHOWS those new columns (unchecked,
                //    because IsTenantRestricted = false) so the user can
                //    opt in if they want. Clicking "Reset Grid" deletes the
                //    snapshot and reverts to tenant defaults, picking up
                //    every newly-added column automatically.
                //
                // 3. DISPLAY ATTRIBUTES (DisplayName, SortOrder, Width,
                //    AggregateType) follow null-coalesce semantics — user
                //    value wins when non-null, otherwise falls back to the
                //    tenant default. Lets the user customize while still
                //    inheriting future tenant changes to fields they
                //    haven't explicitly set.
                var tenantRows = rows.Where(r => r.UserId == TenantDefaultUserId).ToDictionary(r => r.Field);
                var userRowsMap = rows.Where(r => r.UserId == userId).ToDictionary(r => r.Field);
                var globalRows = globalRowsList.ToDictionary(r => r.Field);

                // The "baseline" (non-user) row for a field is the tenant default
                // when present, otherwise the global default. Its AllowedToView is
                // the ceiling — a user override can never flip a hidden baseline
                // column visible.
                var baselineHidden = new HashSet<string>();
                foreach (var field in tenantRows.Keys.Union(globalRows.Keys))
                {
                    bool baselineAllowed = tenantRows.TryGetValue(field, out var tCeil)
                        ? tCeil.AllowedToView
                        : globalRows[field].AllowedToView;
                    if (!baselineAllowed) baselineHidden.Add(field);
                }

                var effective = new Dictionary<string, (bool AllowedToView, string? DisplayName, int? SortOrder, int? Width, string? AggregateType, DateTime DateModified, Guid? ModifiedBy)>();

                // Walk the union of all known fields (tenant + user).
                //
                // VISIBILITY PRECEDENCE:
                //   * User has a row     -> their value wins, capped by the
                //                            tenant ceiling (if tenant hides
                //                            it, user can't unhide it).
                //   * Only tenant has it -> use tenant's value.
                //   * Neither            -> the field never reaches this loop;
                //                            the page's default-column list
                //                            decides visibility upstream.
                //
                // NOTE on snapshot semantics: a previous iteration of this
                // method auto-hid any field without a user row when the user
                // had ANY user rows ("snapshot mode"). That broke existing
                // tenants whose saves were incomplete from earlier smart-save
                // logic — most columns lost visibility on next load. Reverted
                // to plain inherit-from-tenant. Req 5 ("new columns added by
                // SuperAdmin shouldn't auto-appear") is now handled simply by
                // never adding rows for them on the SuperAdmin side either —
                // if the field has no row, it inherits the page default.
                foreach (var field in tenantRows.Keys.Union(userRowsMap.Keys).Union(globalRows.Keys))
                {
                    tenantRows.TryGetValue(field, out var tRow);
                    globalRows.TryGetValue(field, out var gRow);
                    var hasUserRow = userRowsMap.TryGetValue(field, out var uRow);

                    // Baseline visibility: tenant default wins, else global
                    // default, else allowed. This is also the ceiling.
                    bool baselineAllowed = tRow != null
                        ? tRow.AllowedToView
                        : (gRow?.AllowedToView ?? true);

                    bool allowedToView = hasUserRow
                        ? (uRow!.AllowedToView && baselineAllowed)
                        : baselineAllowed;

                    // Display attributes fall back user -> tenant -> global.
                    var displayName    = (hasUserRow ? uRow!.DisplayName    : null) ?? tRow?.DisplayName    ?? gRow?.DisplayName;
                    var sortOrder      = (hasUserRow ? uRow!.SortOrder      : null) ?? tRow?.SortOrder      ?? gRow?.SortOrder;
                    var width          = (hasUserRow ? uRow!.Width          : null) ?? tRow?.Width          ?? gRow?.Width;
                    var aggregateType  = (hasUserRow ? uRow!.AggregateType  : null) ?? tRow?.AggregateType  ?? gRow?.AggregateType;

                    // Provenance (DateModified / ModifiedBy) from the highest-
                    // precedence source that actually has a row.
                    DateTime dateModified;
                    Guid? modifiedBy;
                    if (hasUserRow)       { dateModified = uRow!.DateModified; modifiedBy = uRow.ModifiedBy; }
                    else if (tRow != null) { dateModified = tRow.DateModified;  modifiedBy = tRow.ModifiedBy; }
                    else                   { dateModified = gRow!.DateModified; modifiedBy = gRow.ModifiedBy; }

                    effective[field] = (
                        allowedToView,
                        displayName,
                        sortOrder,
                        width,
                        aggregateType,
                        dateModified,
                        modifiedBy);
                }

                // "Version" / provenance across every contributing row
                // (tenant + user from tenant DB, plus global from main DB).
                DateTime? lastModified = null;
                Guid? lastModifiedBy = null;
                foreach (var r in rows)
                {
                    if (lastModified == null || r.DateModified > lastModified)
                    {
                        lastModified = r.DateModified;
                        lastModifiedBy = r.ModifiedBy;
                    }
                }
                foreach (var g in globalRowsList)
                {
                    if (lastModified == null || g.DateModified > lastModified)
                    {
                        lastModified = g.DateModified;
                        lastModifiedBy = g.ModifiedBy;
                    }
                }

                var response = new GridColumnAccessResponseDto
                {
                    UserId = userId,
                    GridId = gridId,
                    Columns = effective.Select(kv => new ColumnAccessItemDto
                    {
                        Field = kv.Key,
                        AllowedToView = kv.Value.AllowedToView,
                        DisplayName = kv.Value.DisplayName,
                        SortOrder = kv.Value.SortOrder,
                        Width = kv.Value.Width,
                        AggregateType = kv.Value.AggregateType,
                        // IsTenantRestricted = true ONLY when the tenant
                        // default row explicitly hid the column. Lets the
                        // frontend tell "Super Admin revoked access" apart
                        // from "user toggled it off in their chooser" —
                        // both have AllowedToView=false in the merged
                        // result, but only the former should strip the
                        // column from the chooser entirely. A hidden GLOBAL
                        // default (with no tenant row) is treated the same way.
                        IsTenantRestricted = baselineHidden.Contains(kv.Key)
                    }).ToList(),
                    LastModified = lastModified,
                    ModifiedBy = lastModifiedBy
                };

                return new ApiResult<GridColumnAccessResponseDto>
                {
                    IsSuccess = true,
                    Message = (rows.Count > 0 || globalRowsList.Count > 0)
                        ? "Effective column access rules retrieved (global + tenant defaults merged with user overrides)."
                        : "No rules found — all columns allowed by default.",
                    Response = response
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<GridColumnAccessResponseDto>
                {
                    IsSuccess = false,
                    Message = $"Error retrieving effective column access: {ex.Message}",
                    Response = new GridColumnAccessResponseDto
                    {
                        UserId = userId,
                        GridId = gridId,
                        Columns = new List<ColumnAccessItemDto>()
                    }
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<bool>> SaveAsync(SaveGridColumnAccessDto dto, Guid modifiedBy)
        {
            if (string.IsNullOrWhiteSpace(dto.GridId))
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = "GridId is required.",
                    Response = false
                };
            }

            // Note: no explicit BeginTransaction here. EF Core wraps all pending
            // changes tracked by a single SaveChangesAsync() call in one implicit
            // DB transaction automatically — so the wipe-and-insert is already
            // atomic. This also plays nicely with SqlServerRetryingExecutionStrategy
            // (which forbids user-initiated transactions).
            try
            {
                // When saving for a specific user (not the tenant default),
                // fetch tenant defaults so we can filter the incoming payload
                // down to just the fields that actually differ. Fields that
                // match the tenant default are NOT persisted as user rows,
                // so the user automatically inherits future tenant changes.
                Dictionary<string, UserGridColumnAccess>? tenantDefaults = null;
                if (dto.UserId != TenantDefaultUserId)
                {
                    tenantDefaults = await _context.UserGridColumnAccess
                        .AsNoTracking()
                        .Where(x => x.UserId == TenantDefaultUserId && x.GridId == dto.GridId)
                        .ToDictionaryAsync(x => x.Field);
                }

                var existing = await _context.UserGridColumnAccess
                    .Where(x => x.UserId == dto.UserId && x.GridId == dto.GridId)
                    .ToListAsync();

                if (existing.Count > 0)
                {
                    _context.UserGridColumnAccess.RemoveRange(existing);
                }

                var now = DateTime.UtcNow;

                // Normalize and persist each incoming row.
                //
                // BEHAVIOR DIFFERS BY SAVE TYPE:
                //
                //  * Tenant-default save (dto.UserId == TenantDefaultUserId):
                //    Persist every column verbatim — there's no baseline to
                //    compare against. tenantDefaults is null here.
                //
                //  * User save (dto.UserId != TenantDefaultUserId):
                //    Persist a row for EVERY incoming column (no smart-save
                //    skipping for AllowedToView). This is what gives us
                //    snapshot semantics on the read side — once a user has
                //    saved, their row set IS the visibility snapshot, and a
                //    later admin "allow new column" change doesn't auto-
                //    reveal anything. For non-visibility fields (DisplayName,
                //    SortOrder, Width, AggregateType) we still smart-save:
                //    if the user value matches the tenant default, we store
                //    NULL so the merge falls back and the user inherits
                //    future tenant changes for that attribute.
                var newRows = new List<UserGridColumnAccess>();
                foreach (var c in dto.Columns)
                {
                    if (string.IsNullOrWhiteSpace(c.Field)) continue;

                    var normalizedDisplayName = string.IsNullOrWhiteSpace(c.DisplayName)
                        ? null
                        : c.DisplayName.Trim();

                    var normalizedAggregateType = string.IsNullOrWhiteSpace(c.AggregateType)
                        ? null
                        : c.AggregateType.Trim();

                    // CEILING ENFORCEMENT for user saves: tenant says hidden
                    // => persisted value is hidden, regardless of what the
                    // payload claims. Defends against a stale/crafted client
                    // trying to flip a tenant-restricted column visible.
                    var allowedToViewToPersist = c.AllowedToView;
                    UserGridColumnAccess? tenantRow = null;
                    if (tenantDefaults != null
                        && tenantDefaults.TryGetValue(c.Field, out tenantRow)
                        && !tenantRow.AllowedToView)
                    {
                        allowedToViewToPersist = false;
                    }

                    // Smart-save the display attributes: store NULL when the
                    // user's value matches the tenant default, so the merge
                    // falls back to tenant. This lets admin renames /
                    // reorders / width / aggregate changes propagate. Only
                    // applies to user saves (tenantDefaults != null).
                    var displayNameToPersist = normalizedDisplayName;
                    var sortOrderToPersist = c.SortOrder;
                    var widthToPersist = c.Width;
                    var aggregateTypeToPersist = normalizedAggregateType;
                    if (tenantDefaults != null && tenantRow != null)
                    {
                        if (tenantRow.DisplayName == normalizedDisplayName)
                            displayNameToPersist = null;
                        if (tenantRow.SortOrder == c.SortOrder)
                            sortOrderToPersist = null;
                        if (tenantRow.Width == c.Width)
                            widthToPersist = null;
                        if (tenantRow.AggregateType == normalizedAggregateType)
                            aggregateTypeToPersist = null;
                    }

                    newRows.Add(new UserGridColumnAccess
                    {
                        UserId = dto.UserId,
                        GridId = dto.GridId,
                        Field = c.Field,
                        AllowedToView = allowedToViewToPersist,
                        DisplayName = displayNameToPersist,
                        SortOrder = sortOrderToPersist,
                        Width = widthToPersist,
                        AggregateType = aggregateTypeToPersist,
                        DateCreated = now,
                        DateModified = now,
                        ModifiedBy = modifiedBy
                    });
                }

                if (newRows.Count > 0)
                {
                    await _context.UserGridColumnAccess.AddRangeAsync(newRows);
                }

                // Single call — all deletes + inserts committed atomically.
                await _context.SaveChangesAsync();

                return new ApiResult<bool>
                {
                    IsSuccess = true,
                    Message = tenantDefaults != null
                        ? $"Saved {newRows.Count} column preference(s) as user snapshot."
                        : "Tenant-wide defaults saved.",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = $"Error saving column access: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<DateTime?>> GetVersionForUserAsync(Guid userId, string gridId)
        {
            try
            {
                // We only need the max DateModified across rows that affect
                // this user — their own overrides plus the tenant defaults.
                // Using OrderByDescending().FirstOrDefaultAsync() instead of
                // MaxAsync() to safely return null when no rows match (MaxAsync
                // on an empty sequence throws InvalidOperationException).
                var version = await _context.UserGridColumnAccess
                    .AsNoTracking()
                    .Where(x => x.GridId == gridId &&
                                (x.UserId == TenantDefaultUserId || x.UserId == userId))
                    .OrderByDescending(x => x.DateModified)
                    .Select(x => (DateTime?)x.DateModified)
                    .FirstOrDefaultAsync();

                return new ApiResult<DateTime?>
                {
                    IsSuccess = true,
                    Message = version.HasValue ? "Version retrieved." : "No rules — no version.",
                    Response = version
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<DateTime?>
                {
                    IsSuccess = false,
                    Message = $"Error retrieving column-access version: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<bool>> ResetForUserAndGridAsync(Guid userId, string gridId)
        {
            try
            {
                var rows = await _context.UserGridColumnAccess
                    .Where(x => x.UserId == userId && x.GridId == gridId)
                    .ToListAsync();

                if (rows.Count == 0)
                {
                    return new ApiResult<bool>
                    {
                        IsSuccess = true,
                        Message = "No rules found to reset.",
                        Response = true
                    };
                }

                _context.UserGridColumnAccess.RemoveRange(rows);
                await _context.SaveChangesAsync();

                return new ApiResult<bool>
                {
                    IsSuccess = true,
                    Message = $"Reset {rows.Count} column access rules.",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = $"Error resetting column access: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<GridColumnAccessResponseDto>> GetDefaultAsync(string gridId)
        {
            try
            {
                var rows = await _mainDb.DefaultGridColumnAccess
                    .AsNoTracking()
                    .Where(x => x.GridId == gridId)
                    .ToListAsync();

                var response = new GridColumnAccessResponseDto
                {
                    UserId = TenantDefaultUserId,
                    GridId = gridId,
                    Columns = rows.Select(r => new ColumnAccessItemDto
                    {
                        Field = r.Field,
                        AllowedToView = r.AllowedToView,
                        DisplayName = r.DisplayName,
                        SortOrder = r.SortOrder,
                        Width = r.Width,
                        AggregateType = r.AggregateType
                    }).ToList(),
                    LastModified = rows.Count > 0 ? rows.Max(r => r.DateModified) : (DateTime?)null,
                    ModifiedBy = rows.Count > 0
                        ? rows.OrderByDescending(r => r.DateModified).First().ModifiedBy
                        : null
                };

                return new ApiResult<GridColumnAccessResponseDto>
                {
                    IsSuccess = true,
                    Message = rows.Count > 0
                        ? "Global default column config retrieved."
                        : "No global default saved — page defaults apply.",
                    Response = response
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<GridColumnAccessResponseDto>
                {
                    IsSuccess = false,
                    Message = $"Error retrieving global default column config: {ex.Message}",
                    Response = new GridColumnAccessResponseDto
                    {
                        UserId = TenantDefaultUserId,
                        GridId = gridId,
                        Columns = new List<ColumnAccessItemDto>()
                    }
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<bool>> SaveDefaultAsync(SaveGridColumnAccessDto dto, Guid modifiedBy)
        {
            if (string.IsNullOrWhiteSpace(dto.GridId))
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = "GridId is required.",
                    Response = false
                };
            }

            try
            {
                // Wipe-and-insert for this grid. dto.UserId is ignored — the
                // global default has no user or tenant key. EF wraps the
                // delete + insert in one implicit transaction per SaveChanges.
                var existing = await _mainDb.DefaultGridColumnAccess
                    .Where(x => x.GridId == dto.GridId)
                    .ToListAsync();

                if (existing.Count > 0)
                {
                    _mainDb.DefaultGridColumnAccess.RemoveRange(existing);
                }

                var now = DateTime.UtcNow;
                var newRows = new List<DefaultGridColumnAccess>();
                foreach (var c in dto.Columns)
                {
                    if (string.IsNullOrWhiteSpace(c.Field)) continue;

                    newRows.Add(new DefaultGridColumnAccess
                    {
                        GridId = dto.GridId,
                        Field = c.Field,
                        AllowedToView = c.AllowedToView,
                        DisplayName = string.IsNullOrWhiteSpace(c.DisplayName) ? null : c.DisplayName.Trim(),
                        SortOrder = c.SortOrder,
                        Width = c.Width,
                        AggregateType = string.IsNullOrWhiteSpace(c.AggregateType) ? null : c.AggregateType.Trim(),
                        DateCreated = now,
                        DateModified = now,
                        ModifiedBy = modifiedBy
                    });
                }

                if (newRows.Count > 0)
                {
                    await _mainDb.DefaultGridColumnAccess.AddRangeAsync(newRows);
                }

                await _mainDb.SaveChangesAsync();

                return new ApiResult<bool>
                {
                    IsSuccess = true,
                    Message = $"Saved {newRows.Count} global default column(s).",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = $"Error saving global default column config: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResult<bool>> ResetDefaultAsync(string gridId)
        {
            try
            {
                var rows = await _mainDb.DefaultGridColumnAccess
                    .Where(x => x.GridId == gridId)
                    .ToListAsync();

                if (rows.Count == 0)
                {
                    return new ApiResult<bool>
                    {
                        IsSuccess = true,
                        Message = "No global default to reset.",
                        Response = true
                    };
                }

                _mainDb.DefaultGridColumnAccess.RemoveRange(rows);
                await _mainDb.SaveChangesAsync();

                return new ApiResult<bool>
                {
                    IsSuccess = true,
                    Message = $"Reset {rows.Count} global default column(s).",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool>
                {
                    IsSuccess = false,
                    Message = $"Error resetting global default column config: {ex.Message}",
                    Response = false
                };
            }
        }
    }
}
