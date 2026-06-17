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
    public class GetSalesInDateRangeTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetSalesInDateRangeTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_sales_in_date_range";

        public override string Description =>
            "Returns daily sales totals between two specific dates (inclusive). Use this ONLY when the user specifies explicit calendar dates like 'from 2025-11-12 to today' or 'between Jan 1 and Mar 31'. For relative windows like 'last 30 days' use get_sales_trend instead. If toDate is omitted it defaults to today.";

        public override string PermissionKey => "chatbot:tool.get_sales_in_date_range";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""fromDate"": { ""type"": ""string"", ""description"": ""Start date in YYYY-MM-DD format (inclusive)."" },
            ""toDate"":   { ""type"": ""string"", ""description"": ""End date in YYYY-MM-DD format (inclusive). Omit or pass 'today' for current date."" }
          },
          ""required"": [""fromDate""]
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? fromStr = null;
            string? toStr = null;

            try
            {
                using var doc = JsonDocument.Parse(argumentsJson);
                var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                if (root.TryGetProperty("fromDate", out var f)) fromStr = f.GetString();
                if (root.TryGetProperty("toDate", out var t)) toStr = t.GetString();
            }
            catch (JsonException)
            {
                return ChatToolResult.Fail("Invalid JSON arguments.");
            }

            if (!TryParseDate(fromStr, out var fromDate))
                return ChatToolResult.Fail("'fromDate' is required in YYYY-MM-DD format.");

            DateTime toDate;
            if (string.IsNullOrWhiteSpace(toStr) || toStr.Equals("today", StringComparison.OrdinalIgnoreCase))
            {
                toDate = DateTime.UtcNow.Date;
            }
            else if (!TryParseDate(toStr, out toDate))
            {
                return ChatToolResult.Fail("'toDate' must be YYYY-MM-DD or 'today'.");
            }

            if (toDate < fromDate)
                return ChatToolResult.Fail("'toDate' must be >= 'fromDate'.");

            var totalDays = (int)(toDate - fromDate).TotalDays + 1;
            if (totalDays > 1095)
                return ChatToolResult.Fail("Date range too large (max 3 years).");

            var endExclusive = toDate.AddDays(1);

            var raw = await _db.Set<Transaction>()
                .AsNoTracking()
                .Where(t => t.Status == 1
                            && t.StartSaleTime != null
                            && t.StartSaleTime >= fromDate
                            && t.StartSaleTime < endExclusive)
                .Select(t => new { t.StartSaleTime, t.Debit })
                .ToListAsync(ct);

            var byDay = raw
                .Where(x => x.StartSaleTime.HasValue)
                .GroupBy(x => x.StartSaleTime!.Value.Date)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Debit ?? 0m));

            var categories = Enumerable.Range(0, totalDays).Select(i => fromDate.AddDays(i)).ToList();
            var data = categories.Select(d => byDay.TryGetValue(d, out var v) ? v : 0m).ToList();
            var total = data.Sum();

            if (total == 0m)
            {
                return ChatToolResult.Ok(JsonSerializer.Serialize(new
                {
                    fromDate = fromDate.ToString("yyyy-MM-dd"),
                    toDate = toDate.ToString("yyyy-MM-dd"),
                    totalSales = 0m,
                    note = $"No completed sales between {fromDate:yyyy-MM-dd} and {toDate:yyyy-MM-dd}."
                }));
            }

            var chart = new ChatVisualizationDto
            {
                Type = "line",
                Title = $"Sales {fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}",
                XAxisLabel = "Date",
                YAxisLabel = "Total sales",
                Categories = categories.Select(d => d.ToString("MMM dd")).ToList(),
                Series = { new ChatChartSeriesDto { Name = "Sales", Data = data } }
            };

            return ChatToolResult.OkWithChart(JsonSerializer.Serialize(new
            {
                fromDate = fromDate.ToString("yyyy-MM-dd"),
                toDate = toDate.ToString("yyyy-MM-dd"),
                totalDays,
                totalSales = total,
                avgDailySales = Math.Round(total / totalDays, 2),
                peakDay = categories[data.IndexOf(data.Max())].ToString("yyyy-MM-dd"),
                peakAmount = data.Max()
            }), chart);
        }

        private static bool TryParseDate(string? s, out DateTime date)
        {
            date = default;
            if (string.IsNullOrWhiteSpace(s)) return false;
            var formats = new[] { "yyyy-MM-dd", "yyyy/MM/dd", "MM/dd/yyyy", "M/d/yyyy", "d/M/yyyy" };
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
