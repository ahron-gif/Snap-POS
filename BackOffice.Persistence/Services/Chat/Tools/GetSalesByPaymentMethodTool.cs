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
    public class GetSalesByPaymentMethodTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetSalesByPaymentMethodTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_sales_by_payment_method";

        public override string Description =>
            "Returns tender (payment method) totals. Pie chart. Accepts 'days' OR 'fromDate'/'toDate'. Use for 'cash vs credit', 'payment breakdown'.";

        public override string PermissionKey => "chatbot:tool.get_sales_by_payment_method";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""days"": { ""type"": ""integer"", ""description"": ""Look-back window. Ignored if fromDate set. Default 30."", ""default"": 30, ""minimum"": 1, ""maximum"": 3650 },
            ""fromDate"": { ""type"": ""string"", ""description"": ""Optional start YYYY-MM-DD."" },
            ""toDate"":   { ""type"": ""string"", ""description"": ""Optional end YYYY-MM-DD or 'today'."" }
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

            if (!ChatDateRange.TryResolve(root, 30, 1, 3650, out var range, out var err))
                return ChatToolResult.Fail(err!);

            var results = await (from te in _db.Set<TenderEntry>().AsNoTracking()
                                 join tn in _db.Set<Tender>().AsNoTracking() on te.TenderID equals tn.TenderID
                                 where te.TenderDate != null
                                       && te.TenderDate >= range.FromDate
                                       && te.TenderDate < range.EndExclusive
                                 group te by tn.TenderName into g
                                 select new
                                 {
                                     method = g.Key,
                                     total = g.Sum(x => x.Amount ?? 0m)
                                 })
                .OrderByDescending(x => x.total)
                .ToListAsync(ct);

            if (results.Count == 0)
            {
                return ChatToolResult.Ok(JsonSerializer.Serialize(new
                {
                    windowLabel = range.Label, count = 0,
                    note = $"No payments between {range.FromDate:yyyy-MM-dd} and {range.ToDate:yyyy-MM-dd}."
                }));
            }

            var chart = new ChatVisualizationDto
            {
                Type = "pie",
                Title = $"Payment method breakdown ({range.Label})",
                Categories = results.Select(r => r.method ?? "(unknown)").ToList(),
                Series = { new ChatChartSeriesDto { Name = "Amount", Data = results.Select(r => r.total).ToList() } }
            };

            return ChatToolResult.OkWithChart(
                JsonSerializer.Serialize(new { windowLabel = range.Label, count = results.Count, methods = results }),
                chart);
        }
    }
}
