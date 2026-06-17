using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Application.Services.Chat.Tools;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Services.Chat.Tools
{
    public class GetProfitSummaryTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetProfitSummaryTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_profit_summary";

        public override string Description =>
            "Returns revenue, cost, profit, and margin % for a window. Accepts 'days' OR 'fromDate'/'toDate'. Use for 'profit this month', 'margin Apr to today'.";

        public override string PermissionKey => "chatbot:tool.get_profit_summary";

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

            var agg = await (from te in _db.Set<TransactionEntry>().AsNoTracking()
                             join t in _db.Set<Transaction>().AsNoTracking() on te.TransactionID equals t.TransactionID
                             where t.Status == 1
                                   && t.StartSaleTime >= range.FromDate
                                   && t.StartSaleTime < range.EndExclusive
                             select new
                             {
                                 revenue = te.Total ?? 0m,
                                 cogs = (te.Cost ?? 0m) * (te.Qty ?? 0m)
                             })
                .ToListAsync(ct);

            var totalRevenue = agg.Sum(x => x.revenue);
            var totalCogs = agg.Sum(x => x.cogs);
            var profit = totalRevenue - totalCogs;
            decimal margin = totalRevenue > 0 ? System.Math.Round(profit / totalRevenue * 100, 2) : 0m;

            return ChatToolResult.Ok(JsonSerializer.Serialize(new
            {
                windowLabel = range.Label,
                fromDate = range.FromDate.ToString("yyyy-MM-dd"),
                toDate = range.ToDate.ToString("yyyy-MM-dd"),
                revenue = System.Math.Round(totalRevenue, 2),
                cost = System.Math.Round(totalCogs, 2),
                profit = System.Math.Round(profit, 2),
                marginPct = margin,
                lineItemCount = agg.Count
            }));
        }
    }
}
