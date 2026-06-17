using System;
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
    public class GetLowMarginItemsTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetLowMarginItemsTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_low_margin_items";

        public override string Description =>
            "Returns items whose profit margin is below a threshold. Accepts 'days' OR 'fromDate'/'toDate'. Use for 'low margin items', 'unprofitable SKUs Apr 2024 to today'.";

        public override string PermissionKey => "chatbot:tool.get_low_margin_items";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""days"": { ""type"": ""integer"", ""description"": ""Look-back window. Ignored if fromDate set. Default 30."", ""default"": 30, ""minimum"": 1, ""maximum"": 3650 },
            ""fromDate"": { ""type"": ""string"", ""description"": ""Optional start YYYY-MM-DD."" },
            ""toDate"":   { ""type"": ""string"", ""description"": ""Optional end YYYY-MM-DD or 'today'."" },
            ""maxMarginPct"": { ""type"": ""number"", ""description"": ""Items with margin%% less than or equal to this. Default 10."", ""default"": 10 },
            ""limit"": { ""type"": ""integer"", ""description"": ""Max items (1-25). Default 10."", ""default"": 10, ""minimum"": 1, ""maximum"": 25 }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            decimal maxMarginPct = 10m;
            int limit = 10;
            JsonElement root;
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(argumentsJson) ? "{}" : argumentsJson);
                root = doc.RootElement.TryGetProperty("args", out var a) ? a.Clone() : doc.RootElement.Clone();
                if (root.TryGetProperty("maxMarginPct", out var m) && m.ValueKind == JsonValueKind.Number)
                    maxMarginPct = m.GetDecimal();
                if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                    limit = System.Math.Clamp(l.GetInt32(), 1, 25);
            }
            catch (JsonException) { return ChatToolResult.Fail("Invalid JSON arguments."); }

            if (!ChatDateRange.TryResolve(root, 30, 1, 3650, out var range, out var err))
                return ChatToolResult.Fail(err!);

            var perItem = await (from te in _db.Set<TransactionEntryItem>().AsNoTracking()
                                 join t in _db.Set<Transaction>().AsNoTracking() on te.TransactionID equals t.TransactionID
                                 where t.Status == 1
                                       && t.StartSaleTime >= range.FromDate
                                       && t.StartSaleTime < range.EndExclusive
                                       && te.ItemID != null
                                 group te by new { te.ItemID, te.Name } into g
                                 select new
                                 {
                                     itemId = g.Key.ItemID!.Value,
                                     name = g.Key.Name,
                                     revenue = g.Sum(x => x.Total ?? 0m),
                                     cogs = g.Sum(x => (x.Cost ?? 0m) * (x.QTY ?? 0m)),
                                     qty = g.Sum(x => x.QTY ?? 0m)
                                 })
                .Where(x => x.revenue > 0)
                .ToListAsync(ct);

            var filtered = perItem
                .Select(x => new
                {
                    x.itemId,
                    x.name,
                    x.qty,
                    x.revenue,
                    profit = x.revenue - x.cogs,
                    marginPct = System.Math.Round((x.revenue - x.cogs) / x.revenue * 100, 2)
                })
                .Where(x => x.marginPct <= maxMarginPct)
                .OrderBy(x => x.marginPct)
                .Take(limit)
                .ToList();

            return ChatToolResult.Ok(JsonSerializer.Serialize(new
            {
                windowLabel = range.Label,
                fromDate = range.FromDate.ToString("yyyy-MM-dd"),
                toDate = range.ToDate.ToString("yyyy-MM-dd"),
                maxMarginPct,
                count = filtered.Count,
                items = filtered
            }));
        }
    }
}
