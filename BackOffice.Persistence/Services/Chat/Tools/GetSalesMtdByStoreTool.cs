using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Application.Services.Chat.Tools;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Services.Chat.Tools
{
    public class GetSalesMtdByStoreTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetSalesMtdByStoreTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_sales_mtd_by_store";

        public override string Description =>
            "Returns sales totals grouped by store, rendered as a bar chart. Supports THREE input modes: (1) default = current MTD; (2) 'year'+'month' for a specific calendar month; (3) 'fromDate'+'toDate' for an arbitrary window.";

        public override string PermissionKey => "chatbot:tool.get_sales_mtd_by_store";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""year"":  { ""type"": ""integer"", ""description"": ""4-digit year. Use with 'month'. Ignored if fromDate is set."", ""minimum"": 2000, ""maximum"": 2100 },
            ""month"": { ""type"": ""integer"", ""description"": ""Month 1-12. Use with 'year'. Ignored if fromDate is set."", ""minimum"": 1, ""maximum"": 12 },
            ""fromDate"": { ""type"": ""string"", ""description"": ""Optional start YYYY-MM-DD. Overrides year/month."" },
            ""toDate"":   { ""type"": ""string"", ""description"": ""Optional end YYYY-MM-DD or 'today'."" }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            var now = DateTime.UtcNow;
            int? year = null;
            int? month = null;
            string? fromStr = null;
            string? toStr = null;

            if (!string.IsNullOrWhiteSpace(argumentsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(argumentsJson);
                    var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                    if (root.TryGetProperty("year", out var y) && y.ValueKind == JsonValueKind.Number) year = y.GetInt32();
                    if (root.TryGetProperty("month", out var m) && m.ValueKind == JsonValueKind.Number) month = m.GetInt32();
                    if (root.TryGetProperty("fromDate", out var fd)) fromStr = fd.GetString();
                    if (root.TryGetProperty("toDate", out var td)) toStr = td.GetString();
                }
                catch (JsonException) { return ChatToolResult.Fail("Invalid JSON arguments."); }
            }

            DateTime fromDate;
            DateTime endExclusive;
            string windowLabel;
            bool isCurrentMonth;

            if (!string.IsNullOrWhiteSpace(fromStr))
            {
                if (!ChatDateRange.TryParseDate(fromStr, out fromDate))
                    return ChatToolResult.Fail("'fromDate' must be YYYY-MM-DD.");
                DateTime toDate;
                if (string.IsNullOrWhiteSpace(toStr) || toStr.Equals("today", StringComparison.OrdinalIgnoreCase))
                    toDate = now.Date;
                else if (!ChatDateRange.TryParseDate(toStr, out toDate))
                    return ChatToolResult.Fail("'toDate' must be YYYY-MM-DD or 'today'.");
                if (toDate < fromDate)
                    return ChatToolResult.Fail("'toDate' must be >= 'fromDate'.");
                endExclusive = toDate.AddDays(1);
                windowLabel = $"{fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}";
                isCurrentMonth = false;
            }
            else
            {
                var y = year ?? now.Year;
                var m = month ?? now.Month;
                if (y < 2000 || y > 2100 || m < 1 || m > 12)
                    return ChatToolResult.Fail("Invalid year/month.");
                fromDate = new DateTime(y, m, 1, 0, 0, 0, DateTimeKind.Utc);
                endExclusive = fromDate.AddMonths(1);
                isCurrentMonth = y == now.Year && m == now.Month;
                windowLabel = fromDate.ToString("MMM yyyy");
            }

            var perStore = await _db.Set<Transaction>()
                .AsNoTracking()
                .Where(t => t.Status == 1
                            && t.StartSaleTime != null
                            && t.StartSaleTime >= fromDate
                            && t.StartSaleTime < endExclusive
                            && t.StoreID != null)
                .GroupBy(t => t.StoreID!.Value)
                .Select(g => new
                {
                    storeId = g.Key,
                    totalSales = g.Sum(x => x.Debit ?? 0m)
                })
                .OrderByDescending(x => x.totalSales)
                .ToListAsync(ct);

            if (perStore.Count == 0)
            {
                var latest = await _db.Set<Transaction>().AsNoTracking()
                    .Where(t => t.Status == 1 && t.StartSaleTime != null)
                    .MaxAsync(t => (DateTime?)t.StartSaleTime, ct);

                var note = latest == null
                    ? "No completed sales exist in this tenant."
                    : $"No completed sales in {windowLabel}. Latest sale on record is {latest:yyyy-MM-dd}.";

                return ChatToolResult.Ok(JsonSerializer.Serialize(new
                {
                    windowLabel,
                    count = 0,
                    latestSaleUtc = latest,
                    note
                }));
            }

            var storeIds = perStore.Select(x => x.storeId).ToList();
            var stores = await _db.Set<Store>()
                .AsNoTracking()
                .Where(s => storeIds.Contains(s.StoreID))
                .Select(s => new { s.StoreID, s.StoreName, s.StoreNumber })
                .ToListAsync(ct);

            var nameLookup = stores.ToDictionary(x => x.StoreID);

            var enriched = perStore
                .Select(x =>
                {
                    nameLookup.TryGetValue(x.storeId, out var s);
                    var label = !string.IsNullOrWhiteSpace(s?.StoreName)
                        ? s!.StoreName!
                        : (!string.IsNullOrWhiteSpace(s?.StoreNumber)
                            ? s!.StoreNumber!
                            : x.storeId.ToString().Substring(0, 8));
                    return new { storeId = x.storeId, storeName = label, totalSales = x.totalSales };
                })
                .ToList();

            var title = isCurrentMonth
                ? $"MTD Sales by Store ({windowLabel})"
                : $"Sales by Store ({windowLabel})";

            var chart = new ChatVisualizationDto
            {
                Type = "bar",
                Horizontal = false,
                Title = title,
                YAxisLabel = "Sales",
                XAxisLabel = "Store",
                Categories = enriched.Select(e => e.storeName).ToList(),
                Series =
                {
                    new ChatChartSeriesDto
                    {
                        Name = "Total Sales",
                        Data = enriched.Select(e => e.totalSales).ToList()
                    }
                }
            };

            var compactJson = JsonSerializer.Serialize(new
            {
                windowLabel,
                isCurrentMonth,
                count = enriched.Count,
                totalAllStores = enriched.Sum(e => e.totalSales),
                stores = enriched.Select(e => new { storeName = e.storeName, totalSales = e.totalSales })
            });

            return ChatToolResult.OkWithChart(compactJson, chart);
        }
    }
}
