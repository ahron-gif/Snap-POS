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
    public class GetSalesTrendTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetSalesTrendTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_sales_trend";

        public override string Description =>
            "Returns daily total sales as a line chart. Accepts EITHER 'days' back from today OR explicit 'fromDate'/'toDate' (YYYY-MM-DD). Use for 'sales trend', 'sales last 30 days', 'sales Apr 2024 to today'.";

        public override string PermissionKey => "chatbot:tool.get_sales_trend";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""days"": { ""type"": ""integer"", ""description"": ""Look-back window (7-3650). Ignored if fromDate is supplied. Default 30."", ""default"": 30, ""minimum"": 7, ""maximum"": 3650 },
            ""fromDate"": { ""type"": ""string"", ""description"": ""Optional start date YYYY-MM-DD. Overrides days."" },
            ""toDate"":   { ""type"": ""string"", ""description"": ""Optional end date YYYY-MM-DD. 'today' or omit for current."" }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            JsonElement root;
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(argumentsJson) ? "{}" : argumentsJson);
                root = doc.RootElement.TryGetProperty("args", out var a) ? a.Clone() : doc.RootElement.Clone();
            }
            catch (JsonException) { return ChatToolResult.Fail("Invalid JSON arguments."); }

            if (!ChatDateRange.TryResolve(root, 30, 7, 3650, out var range, out var err))
                return ChatToolResult.Fail(err!);

            var raw = await _db.Set<Transaction>()
                .AsNoTracking()
                .Where(t => t.Status == 1
                            && t.StartSaleTime != null
                            && t.StartSaleTime >= range.FromDate
                            && t.StartSaleTime < range.EndExclusive)
                .Select(t => new { t.StartSaleTime, t.Debit })
                .ToListAsync(ct);

            var byDay = raw
                .Where(t => t.StartSaleTime.HasValue)
                .GroupBy(t => t.StartSaleTime!.Value.Date)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Debit ?? 0m));

            var categories = Enumerable.Range(0, range.TotalDays).Select(i => range.FromDate.AddDays(i)).ToList();
            var data = categories.Select(d => byDay.TryGetValue(d, out var v) ? v : 0m).ToList();
            var total = data.Sum();

            if (total == 0m)
            {
                return ChatToolResult.Ok(JsonSerializer.Serialize(new
                {
                    windowLabel = range.Label,
                    fromDate = range.FromDate.ToString("yyyy-MM-dd"),
                    toDate = range.ToDate.ToString("yyyy-MM-dd"),
                    totalSales = 0m,
                    note = $"No sales between {range.FromDate:yyyy-MM-dd} and {range.ToDate:yyyy-MM-dd}."
                }));
            }

            var chart = new ChatVisualizationDto
            {
                Type = "line",
                Title = $"Daily sales trend ({range.Label})",
                XAxisLabel = "Date",
                YAxisLabel = "Total sales",
                Categories = categories.Select(d => d.ToString("MMM dd")).ToList(),
                Series = { new ChatChartSeriesDto { Name = "Sales", Data = data } }
            };

            return ChatToolResult.OkWithChart(JsonSerializer.Serialize(new
            {
                windowLabel = range.Label,
                fromDate = range.FromDate.ToString("yyyy-MM-dd"),
                toDate = range.ToDate.ToString("yyyy-MM-dd"),
                totalDays = range.TotalDays,
                totalSales = total,
                avgDailySales = System.Math.Round(total / range.TotalDays, 2),
                peakDay = categories[data.IndexOf(data.Max())].ToString("yyyy-MM-dd"),
                peakAmount = data.Max()
            }), chart);
        }
    }
}
