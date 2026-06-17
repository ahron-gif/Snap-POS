using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.LabelTemplate;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Application.Services.Tenant.LabelImport;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// Imports legacy <c>PrintLabelLayout</c> rows into the web <c>LabelTemplates</c> table for the
    /// tenant DB bound to the current request. Conversion is done by
    /// <see cref="LegacyLabelLayoutConverter"/>; the legacy table is read-only here.
    /// </summary>
    public class LegacyLabelImportService : ILegacyLabelImportService
    {
        private readonly TenantDBContext _context;
        private readonly LegacyLabelLayoutConverter _converter = new();

        public LegacyLabelImportService(TenantDBContext context)
        {
            _context = context;
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<LegacyLayoutPreviewDto>>> GetLegacyLayoutsAsync()
        {
            try
            {
                var existingNames = await GetExistingTemplateNamesAsync();

                var legacy = await _context.PrintLabelLayouts.AsNoTracking().ToListAsync();

                var previews = legacy
                    .Select(row => BuildPreview(row, existingNames))
                    .OrderBy(p => p.LayoutName)
                    .ToList();

                return new ApiResponse<List<LegacyLayoutPreviewDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = $"{previews.Count} legacy layout(s) found",
                    Response = previews
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<LegacyLayoutPreviewDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error reading legacy layouts: {ex.Message}",
                    Response = new List<LegacyLayoutPreviewDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<PaginationResponseDTO<LegacyLayoutPreviewDto>>> GetLegacyLayoutsPagedAsync(PaginationGridDto grid)
        {
            try
            {
                var existingNames = await GetExistingTemplateNamesAsync();
                var legacy = await _context.PrintLabelLayouts.AsNoTracking().ToListAsync();

                var all = legacy.Select(row => BuildPreview(row, existingNames)).ToList();
                int total = all.Count;

                IEnumerable<LegacyLayoutPreviewDto> query = all;

                // Search (matches the grid's CustomGridSearchText against the layout name)
                var search = grid.CustomGridSearchText?.Trim();
                if (!string.IsNullOrWhiteSpace(search))
                    query = query.Where(p => (p.LayoutName ?? string.Empty)
                        .Contains(search, StringComparison.OrdinalIgnoreCase));

                // Per-column header search (ServerGrid sends a JSON `Filters` array).
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
                                "layoutname" => query.Where(p => (p.LayoutName ?? string.Empty).Contains(val, StringComparison.OrdinalIgnoreCase)),
                                "elementcount" => query.Where(p => p.ElementCount.ToString().Contains(val)),
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

                return new ApiResponse<PaginationResponseDTO<LegacyLayoutPreviewDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = $"{recordsFiltered} legacy layout(s)",
                    Response = new PaginationResponseDTO<LegacyLayoutPreviewDto>
                    {
                        TotalRecords = total,
                        RecordsFiltered = recordsFiltered,
                        Data = pageData
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<PaginationResponseDTO<LegacyLayoutPreviewDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error reading legacy layouts: {ex.Message}",
                    Response = new PaginationResponseDTO<LegacyLayoutPreviewDto> { Data = new List<LegacyLayoutPreviewDto>() }
                };
            }
        }

        private LegacyLayoutPreviewDto BuildPreview(PrintLabelLayout row, HashSet<string> existingNames)
        {
            var r = _converter.Convert(row.LayoutContent, row.LayoutName, row.PrinterType);
            return new LegacyLayoutPreviewDto
            {
                PrintLabelLayoutId = row.PrintLabelLayoutID,
                LayoutName = row.LayoutName ?? r.Name,
                PrinterType = row.PrinterType,
                Status = row.Status,
                Failed = r.Failed,
                AlreadyImported = existingNames.Contains(r.Name),
                LabelType = r.LabelType,
                PaperSize = r.PaperSize,
                LabelWidth = r.LabelWidth,
                LabelHeight = r.LabelHeight,
                ColumnsPerPage = r.ColumnsPerPage,
                RowsPerPage = r.RowsPerPage,
                ElementCount = r.ElementCount,
                DesignJson = r.DesignJson,
                Warnings = r.Warnings
            };
        }

        private static IEnumerable<LegacyLayoutPreviewDto> SortPreviews(
            IEnumerable<LegacyLayoutPreviewDto> source, string? sortColumn, string? sortDirection)
        {
            bool desc = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);
            Func<LegacyLayoutPreviewDto, object> key = (sortColumn ?? "layoutName").ToLowerInvariant() switch
            {
                "labeltype" => p => p.LabelType,
                "labelwidth" => p => p.LabelWidth,
                "labelheight" => p => p.LabelHeight,
                "columnsperpage" => p => p.ColumnsPerPage,
                "elementcount" => p => p.ElementCount,
                "alreadyimported" => p => p.AlreadyImported,
                "printertype" => p => p.PrinterType ?? -999,
                _ => p => p.LayoutName ?? string.Empty
            };
            return desc ? source.OrderByDescending(key) : source.OrderBy(key);
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<LegacyLabelImportResultDto>> ImportAsync(LegacyLabelImportRequestDto request, Guid? userId)
        {
            try
            {
                var query = _context.PrintLabelLayouts.AsNoTracking().AsQueryable();
                if (request.LayoutIds is { Count: > 0 })
                {
                    var ids = request.LayoutIds.ToHashSet();
                    query = query.Where(x => ids.Contains(x.PrintLabelLayoutID));
                }

                var legacy = await query.ToListAsync();

                // Existing non-deleted templates keyed by name (for skip / overwrite).
                var existing = await _context.LabelTemplates
                    .Where(x => x.Status >= 0)
                    .ToListAsync();
                var existingByName = existing
                    .GroupBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

                var result = new LegacyLabelImportResultDto { Total = legacy.Count };

                foreach (var row in legacy)
                {
                    var r = _converter.Convert(row.LayoutContent, row.LayoutName, row.PrinterType);
                    var item = new LegacyLabelImportItemDto
                    {
                        PrintLabelLayoutId = row.PrintLabelLayoutID,
                        LayoutName = r.Name,
                        Warnings = r.Warnings
                    };

                    if (r.Failed || r.ElementCount == 0)
                    {
                        item.Outcome = "failed";
                        result.Failed++;
                        result.Items.Add(item);
                        continue;
                    }

                    if (existingByName.TryGetValue(r.Name, out var existingTemplate))
                    {
                        if (!request.OverwriteExisting)
                        {
                            item.Outcome = "skipped-exists";
                            item.TemplateId = existingTemplate.Id;
                            result.Skipped++;
                            result.Items.Add(item);
                            continue;
                        }

                        ApplyConversion(existingTemplate, r);
                        existingTemplate.UserModified = userId;
                        existingTemplate.DateModified = DateTime.UtcNow;
                        item.Outcome = "updated";
                        item.TemplateId = existingTemplate.Id;
                        result.Updated++;
                        result.Items.Add(item);
                    }
                    else
                    {
                        var template = new LabelTemplate
                        {
                            StoreId = null, // global template
                            Name = r.Name,
                            Description = $"Imported from desktop layout \"{r.Name}\"",
                            IsDefault = false,
                            Status = 0,
                            UserCreated = userId,
                            DateCreated = DateTime.UtcNow,
                            UserModified = userId,
                            DateModified = DateTime.UtcNow
                        };
                        ApplyConversion(template, r);
                        await _context.LabelTemplates.AddAsync(template);

                        // Guard against duplicate names within the same import batch.
                        existingByName[r.Name] = template;

                        item.Outcome = "imported";
                        result.Imported++;
                        result.Items.Add(item);
                    }
                }

                await _context.SaveChangesAsync();

                // Surface generated IDs for freshly-inserted rows.
                foreach (var item in result.Items.Where(i => i.Outcome == "imported"))
                {
                    if (existingByName.TryGetValue(item.LayoutName, out var t))
                        item.TemplateId = t.Id;
                }

                return new ApiResponse<LegacyLabelImportResultDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = $"Imported {result.Imported}, updated {result.Updated}, skipped {result.Skipped}, failed {result.Failed}.",
                    Response = result
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<LegacyLabelImportResultDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error importing legacy layouts: {ex.Message}",
                    Response = null
                };
            }
        }

        private async Task<HashSet<string>> GetExistingTemplateNamesAsync()
        {
            var names = await _context.LabelTemplates
                .AsNoTracking()
                .Where(x => x.Status >= 0)
                .Select(x => x.Name)
                .ToListAsync();
            return names.ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        private static void ApplyConversion(LabelTemplate template, LegacyLabelConversionResult r)
        {
            template.LabelType = r.LabelType;
            template.PaperSize = r.PaperSize;
            template.LabelWidth = r.LabelWidth;
            template.LabelHeight = r.LabelHeight;
            template.ColumnsPerPage = r.ColumnsPerPage;
            template.RowsPerPage = r.RowsPerPage;
            template.MarginLeft = r.MarginLeft;
            template.MarginTop = r.MarginTop;
            template.HorizontalGap = r.HorizontalGap;
            template.VerticalGap = r.VerticalGap;
            template.DesignJson = r.DesignJson;
        }
    }
}
