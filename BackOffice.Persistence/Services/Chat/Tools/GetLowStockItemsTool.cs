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
    public class GetLowStockItemsTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetLowStockItemsTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_low_stock_items";

        public override string Description =>
            "Returns items currently below their reorder point (low inventory). Rendered as a bar chart. Use for 'low stock', 'items to reorder', 'what needs restocking'.";

        public override string PermissionKey => "chatbot:tool.get_low_stock_items";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""limit"": { ""type"": ""integer"", ""description"": ""Maximum items to show (1-25). Default 10."", ""default"": 10, ""minimum"": 1, ""maximum"": 25 }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            int limit = 10;
            if (!string.IsNullOrWhiteSpace(argumentsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(argumentsJson);
                    var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                    if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                        limit = System.Math.Clamp(l.GetInt32(), 1, 25);
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            var low = await (from s in _db.Set<ItemStore>().AsNoTracking()
                             join i in _db.Set<ItemMain>().AsNoTracking() on s.ItemNo equals i.ItemID
                             where (s.Status == 0 || s.Status == null)
                                   && s.OnHand.HasValue
                                   && s.ReorderPoint.HasValue
                                   && s.ReorderPoint > 0
                                   && s.OnHand < s.ReorderPoint
                             orderby (s.ReorderPoint - s.OnHand) descending
                             select new
                             {
                                 itemId = i.ItemID,
                                 name = i.Name,
                                 sku = i.BarcodeNumber,
                                 onHand = s.OnHand ?? 0m,
                                 reorderPoint = s.ReorderPoint ?? 0m,
                                 gap = (s.ReorderPoint ?? 0m) - (s.OnHand ?? 0m)
                             })
                .Take(limit)
                .ToListAsync(ct);

            if (low.Count == 0)
            {
                return ChatToolResult.Ok(JsonSerializer.Serialize(new
                {
                    count = 0,
                    note = "No items are below their reorder point right now."
                }));
            }

            var chart = new ChatVisualizationDto
            {
                Type = "bar",
                Horizontal = true,
                Title = "Low stock items (shortage = reorder - on-hand)",
                XAxisLabel = "Shortage",
                Categories = low.Select(x => x.name ?? (x.sku ?? x.itemId.ToString().Substring(0, 8))).ToList(),
                Series =
                {
                    new ChatChartSeriesDto
                    {
                        Name = "Shortage",
                        Data = low.Select(x => x.gap).ToList()
                    }
                }
            };

            return ChatToolResult.OkWithChart(
                JsonSerializer.Serialize(new { count = low.Count, items = low }),
                chart);
        }
    }
}
