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
    public class ListItemsQuickTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public ListItemsQuickTool(TenantDBContext db) { _db = db; }

        public override string Name => "list_items_quick";

        public override string Description =>
            "Lightweight item lookup returning only essential fields (name, UPC, model, price, on-hand). Faster than list_items. Use for 'quick list', 'quick lookup', or simple name/SKU searches.";

        public override string PermissionKey => "chatbot:tool.list_items_quick";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""query"": { ""type"": ""string"", ""description"": ""Optional partial name, UPC, or model number."" },
            ""limit"": { ""type"": ""integer"", ""description"": ""Maximum items (1-50). Default 20."", ""default"": 20, ""minimum"": 1, ""maximum"": 50 }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? query = null;
            int limit = 20;

            if (!string.IsNullOrWhiteSpace(argumentsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(argumentsJson);
                    var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;

                    if (root.TryGetProperty("query", out var q))
                        query = q.GetString();
                    if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                        limit = System.Math.Clamp(l.GetInt32(), 1, 50);
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            var q0 = _db.Set<ItemsQuickListView>().AsNoTracking();

            if (!string.IsNullOrWhiteSpace(query))
            {
                var term = query.Trim();
                q0 = q0.Where(i =>
                    (i.Name != null && i.Name.Contains(term)) ||
                    (i.UPC != null && i.UPC.Contains(term)) ||
                    (i.ModelNo != null && i.ModelNo.Contains(term)));
            }

            var results = await q0
                .OrderBy(i => i.Name)
                .Take(limit)
                .Select(i => new
                {
                    itemStoreId = i.ItemStoreID,
                    itemId = i.ItemID,
                    name = i.Name,
                    modelNo = i.ModelNo,
                    upc = i.UPC,
                    price = i.Price,
                    onHand = i.OnHand,
                    department = i.Deparment,
                    supplier = i.Supplier
                })
                .ToListAsync(ct);

            return ChatToolResult.Ok(JsonSerializer.Serialize(new { count = results.Count, items = results }));
        }
    }
}
