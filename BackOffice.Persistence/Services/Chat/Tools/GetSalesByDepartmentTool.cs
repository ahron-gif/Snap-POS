using System;
using System.Globalization;
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
    public class GetSalesByDepartmentTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetSalesByDepartmentTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_sales_by_department";

        public override string Description =>
            "Returns sales totals grouped by department. Accepts EITHER a relative window ('days' back from today) OR explicit 'fromDate' / 'toDate'. Use explicit dates when the user refers to a specific range like 'this period', 'from Apr 2024 to today', or 'between two dates'. Rendered as a donut chart.";

        public override string PermissionKey => "chatbot:tool.get_sales_by_department";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""days"": { ""type"": ""integer"", ""description"": ""Look-back window back from today (1-3650). Ignored if fromDate is supplied. Default 30."", ""default"": 30, ""minimum"": 1, ""maximum"": 3650 },
            ""fromDate"": { ""type"": ""string"", ""description"": ""Optional start date in YYYY-MM-DD. When provided, overrides 'days'."" },
            ""toDate"":   { ""type"": ""string"", ""description"": ""Optional end date in YYYY-MM-DD. Pass 'today' or omit for the current date."" }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            int days = 30;
            string? fromStr = null;
            string? toStr = null;

            if (!string.IsNullOrWhiteSpace(argumentsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(argumentsJson);
                    var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                    if (root.TryGetProperty("days", out var d) && d.ValueKind == JsonValueKind.Number)
                        days = d.GetInt32();
                    if (root.TryGetProperty("fromDate", out var fd)) fromStr = fd.GetString();
                    if (root.TryGetProperty("toDate", out var td)) toStr = td.GetString();
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            DateTime fromDate;
            DateTime toDate;
            string windowLabel;

            if (!string.IsNullOrWhiteSpace(fromStr))
            {
                if (!TryParseDate(fromStr, out fromDate))
                    return ChatToolResult.Fail("'fromDate' must be YYYY-MM-DD.");
                if (string.IsNullOrWhiteSpace(toStr) || toStr.Equals("today", StringComparison.OrdinalIgnoreCase))
                    toDate = DateTime.UtcNow.Date;
                else if (!TryParseDate(toStr, out toDate))
                    return ChatToolResult.Fail("'toDate' must be YYYY-MM-DD or 'today'.");
                if (toDate < fromDate)
                    return ChatToolResult.Fail("'toDate' must be >= 'fromDate'.");
                windowLabel = $"{fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}";
            }
            else
            {
                if (days < 1) days = 1;
                if (days > 3650) days = 3650;
                fromDate = DateTime.UtcNow.AddDays(-days);
                toDate = DateTime.UtcNow;
                windowLabel = $"last {days} days";
            }

            var endExclusive = toDate.AddDays(1);

            var results = await (from te in _db.Set<TransactionEntryItem>().AsNoTracking()
                                 join t in _db.Set<Transaction>().AsNoTracking() on te.TransactionID equals t.TransactionID
                                 where t.Status == 1
                                       && t.StartSaleTime >= fromDate
                                       && t.StartSaleTime < endExclusive
                                       && te.Department != null
                                 group te by te.Department into g
                                 select new
                                 {
                                     department = g.Key,
                                     total = g.Sum(x => x.Total ?? 0m)
                                 })
                .OrderByDescending(x => x.total)
                .Take(10)
                .ToListAsync(ct);

            if (results.Count == 0)
            {
                return ChatToolResult.Ok(JsonSerializer.Serialize(new
                {
                    windowLabel,
                    fromDate = fromDate.ToString("yyyy-MM-dd"),
                    toDate = toDate.ToString("yyyy-MM-dd"),
                    count = 0,
                    note = $"No sales by department between {fromDate:yyyy-MM-dd} and {toDate:yyyy-MM-dd}."
                }));
            }

            var chart = new ChatVisualizationDto
            {
                Type = "donut",
                Title = $"Sales by department ({windowLabel})",
                Categories = results.Select(r => r.department ?? "(none)").ToList(),
                Series = { new ChatChartSeriesDto { Name = "Sales", Data = results.Select(r => r.total).ToList() } }
            };

            return ChatToolResult.OkWithChart(
                JsonSerializer.Serialize(new
                {
                    windowLabel,
                    fromDate = fromDate.ToString("yyyy-MM-dd"),
                    toDate = toDate.ToString("yyyy-MM-dd"),
                    count = results.Count,
                    departments = results
                }),
                chart);
        }

        private static bool TryParseDate(string? s, out DateTime date)
        {
            date = default;
            if (string.IsNullOrWhiteSpace(s)) return false;
            var formats = new[] { "yyyy-MM-dd", "yyyy/MM/dd", "MM/dd/yyyy", "M/d/yyyy", "d/M/yyyy", "yyyy-MM" };
            if (DateTime.TryParseExact(s.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out date))
            {
                date = date.Date;
                return true;
            }
            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out date))
            {
                date = date.Date;
                return true;
            }
            return false;
        }
    }
}
