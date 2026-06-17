using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.GroupImport;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// Imports legacy desktop user security groups (tenant <c>Groups</c> table) into the web RBAC
    /// roles (<c>RbacTenantRoles</c>) for the tenant DB bound to the current request. The legacy
    /// <c>Groups</c> table is read-only here. Mirrors <c>LegacyLabelImportService</c>.
    /// </summary>
    public class LegacyGroupImportService : ILegacyGroupImportService
    {
        private readonly TenantDBContext _context;

        public LegacyGroupImportService(TenantDBContext context)
        {
            _context = context;
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<PaginationResponseDTO<LegacyGroupPreviewDto>>> GetLegacyGroupsPagedAsync(PaginationGridDto grid)
        {
            try
            {
                var existingCodes = await GetExistingRoleCodesAsync();
                var groups = await _context.Groups.AsNoTracking().ToListAsync();

                var all = groups.Select(g => BuildPreview(g, existingCodes)).ToList();
                int total = all.Count;

                IEnumerable<LegacyGroupPreviewDto> query = all;

                var search = grid.CustomGridSearchText?.Trim();
                if (!string.IsNullOrWhiteSpace(search))
                    query = query.Where(p => (p.GroupName ?? string.Empty).Contains(search, StringComparison.OrdinalIgnoreCase));

                if (!string.IsNullOrWhiteSpace(grid.Filters))
                {
                    try
                    {
                        var parsed = System.Text.Json.JsonSerializer.Deserialize<List<PaginationGridFilterDto>>(
                            grid.Filters, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        foreach (var f in parsed ?? new List<PaginationGridFilterDto>())
                        {
                            if (string.IsNullOrWhiteSpace(f.Value)) continue;
                            var val = f.Value.Trim();
                            query = (f.Col?.ToLowerInvariant()) switch
                            {
                                "groupname" => query.Where(p => (p.GroupName ?? string.Empty).Contains(val, StringComparison.OrdinalIgnoreCase)),
                                "code" => query.Where(p => (p.Code ?? string.Empty).Contains(val, StringComparison.OrdinalIgnoreCase)),
                                _ => query
                            };
                        }
                    }
                    catch { /* ignore malformed filter payloads */ }
                }

                var filtered = SortPreviews(query, grid.SortColumn, grid.SortDirection).ToList();
                int recordsFiltered = filtered.Count;

                int start = Math.Max(0, grid.StartRow);
                int take = grid.EndRow > grid.StartRow ? grid.EndRow - grid.StartRow : recordsFiltered;
                var pageData = filtered.Skip(start).Take(take).ToList();

                return new ApiResponse<PaginationResponseDTO<LegacyGroupPreviewDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = $"{recordsFiltered} legacy group(s)",
                    Response = new PaginationResponseDTO<LegacyGroupPreviewDto>
                    {
                        TotalRecords = total,
                        RecordsFiltered = recordsFiltered,
                        Data = pageData
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<PaginationResponseDTO<LegacyGroupPreviewDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error reading legacy groups: {ex.Message}",
                    Response = new PaginationResponseDTO<LegacyGroupPreviewDto> { Data = new List<LegacyGroupPreviewDto>() }
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<LegacyGroupImportResultDto>> ImportAsync(LegacyGroupImportRequestDto request, int? userId)
        {
            try
            {
                var query = _context.Groups.AsNoTracking().AsQueryable();
                if (request.GroupIds is { Count: > 0 })
                {
                    var ids = request.GroupIds.ToHashSet();
                    query = query.Where(g => ids.Contains(g.GroupID));
                }

                var groups = await query.ToListAsync();

                var existingRoles = await _context.RbacTenantRoles.ToListAsync();
                var existingByCode = existingRoles
                    .GroupBy(r => r.Code, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

                // Tracks every code that is taken (existing + just-created) so two groups that
                // reduce to the same Code don't collide on the unique index.
                var usedCodes = new HashSet<string>(existingByCode.Keys, StringComparer.OrdinalIgnoreCase);

                var result = new LegacyGroupImportResultDto { Total = groups.Count };
                var created = new List<(LegacyGroupImportItemDto item, RbacTenantRole role)>();

                foreach (var g in groups)
                {
                    var item = new LegacyGroupImportItemDto { GroupId = g.GroupID, GroupName = g.GroupName ?? string.Empty };

                    if (string.IsNullOrWhiteSpace(g.GroupName))
                    {
                        item.Outcome = "failed";
                        item.Warnings.Add("Group has no name; cannot create a role.");
                        result.Failed++;
                        result.Items.Add(item);
                        continue;
                    }

                    var code = GenerateCode(g.GroupName);

                    if (existingByCode.TryGetValue(code, out var existing))
                    {
                        if (!request.OverwriteExisting)
                        {
                            item.Outcome = "skipped-exists";
                            item.RoleId = existing.Id;
                            result.Skipped++;
                            result.Items.Add(item);
                            continue;
                        }

                        existing.Name = g.GroupName!;
                        existing.IsActive = IsActive(g.Status);
                        item.Outcome = "updated";
                        item.RoleId = existing.Id;
                        result.Updated++;
                        result.Items.Add(item);
                        continue;
                    }

                    // New role — guarantee a unique Code within this batch.
                    var uniqueCode = code;
                    var suffix = 1;
                    while (usedCodes.Contains(uniqueCode))
                        uniqueCode = $"{code}{++suffix}";
                    if (!string.Equals(uniqueCode, code, StringComparison.OrdinalIgnoreCase))
                        item.Warnings.Add($"Code '{code}' was already taken; imported as '{uniqueCode}'.");
                    usedCodes.Add(uniqueCode);

                    if (g.IsSystem == true)
                        item.Warnings.Add("Source group is marked as a system group; imported as a system role.");
                    if (!IsActive(g.Status))
                        item.Warnings.Add("Source group is inactive; imported as an inactive role.");

                    var role = new RbacTenantRole
                    {
                        Name = g.GroupName!,
                        Code = uniqueCode,
                        Description = "Imported from desktop group.",
                        IsSystemRole = g.IsSystem ?? false,
                        IsActive = IsActive(g.Status),
                        CreatedAt = DateTime.UtcNow,
                        CreatedByUserId = userId
                    };
                    await _context.RbacTenantRoles.AddAsync(role);
                    existingByCode[uniqueCode] = role;

                    item.Outcome = "imported";
                    result.Imported++;
                    result.Items.Add(item);
                    created.Add((item, role));
                }

                await _context.SaveChangesAsync();

                foreach (var (item, role) in created)
                    item.RoleId = role.Id;

                return new ApiResponse<LegacyGroupImportResultDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = $"Imported {result.Imported}, updated {result.Updated}, skipped {result.Skipped}, failed {result.Failed}.",
                    Response = result
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<LegacyGroupImportResultDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error importing legacy groups: {ex.Message}",
                    Response = null
                };
            }
        }

        // ── Helpers ──────────────────────────────────────────────────────────

        private async Task<HashSet<string>> GetExistingRoleCodesAsync()
        {
            var codes = await _context.RbacTenantRoles.AsNoTracking().Select(r => r.Code).ToListAsync();
            return codes.ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        private static LegacyGroupPreviewDto BuildPreview(Group g, HashSet<string> existingCodes)
        {
            var name = g.GroupName ?? string.Empty;
            var code = GenerateCode(name);
            var dto = new LegacyGroupPreviewDto
            {
                GroupId = g.GroupID,
                GroupName = name,
                Code = code,
                IsSystem = g.IsSystem ?? false,
                Status = g.Status,
                IsActive = IsActive(g.Status),
                AlreadyImported = code.Length > 0 && existingCodes.Contains(code),
            };

            if (string.IsNullOrWhiteSpace(name))
            {
                dto.Failed = true;
                dto.Warnings.Add("Group has no name; cannot create a role.");
            }
            if (g.IsSystem == true)
                dto.Warnings.Add("Marked as a system group.");
            if (!IsActive(g.Status))
                dto.Warnings.Add("Group is inactive.");

            return dto;
        }

        /// <summary>Role Code = uppercase, alphanumeric-only (matches the default-role seed convention).</summary>
        private static string GenerateCode(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return string.Empty;
            var code = System.Text.RegularExpressions.Regex.Replace(name.ToUpperInvariant(), "[^A-Z0-9]", "");
            return string.IsNullOrEmpty(code) ? "ROLE" : code;
        }

        /// <summary>Desktop Status: 1 = active; 0/negative = inactive/deleted; null treated as active.</summary>
        private static bool IsActive(short? status) => (status ?? 1) > 0;

        private static IEnumerable<LegacyGroupPreviewDto> SortPreviews(
            IEnumerable<LegacyGroupPreviewDto> source, string? sortColumn, string? sortDirection)
        {
            bool desc = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);
            Func<LegacyGroupPreviewDto, object> key = (sortColumn ?? "groupName").ToLowerInvariant() switch
            {
                "code" => p => p.Code ?? string.Empty,
                "issystem" => p => p.IsSystem,
                "isactive" => p => p.IsActive,
                "alreadyimported" => p => p.AlreadyImported,
                _ => p => p.GroupName ?? string.Empty
            };
            return desc ? source.OrderByDescending(key) : source.OrderBy(key);
        }
    }
}
