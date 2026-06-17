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
    public class ListItemsTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public ListItemsTool(TenantDBContext db) { _db = db; }

        public override string Name => "list_items";

        public override string Description =>
            "Lists items from the main catalog with detailed fields (name, barcode, price, cost, on-hand, department). Use for questions like 'list items', 'find items matching X', 'show items in department Y'. Supports optional name filter.";

        public override string PermissionKey => "chatbot:tool.list_items";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""query"": { ""type"": ""string"", ""description"": ""Optional partial name, barcode, or model number to filter by."" },
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

            var q0 = _db.Set<ItemMainAndStoreGrid>()
                .AsNoTracking()
                .Where(i => i.Status == 0 || i.Status == null);

            if (!string.IsNullOrWhiteSpace(query))
            {
                var term = query.Trim();
                q0 = q0.Where(i =>
                    (i.Name != null && i.Name.Contains(term)) ||
                    (i.BarcodeNumber != null && i.BarcodeNumber.Contains(term)) ||
                    (i.ModalNumber != null && i.ModalNumber.Contains(term)));
            }

            var results = await q0
                .OrderBy(i => i.Name)
                .Take(limit)
                .Select(i => new
                {
                    itemId = i.ItemID,
                    name = i.Name,
                    barcode = i.BarcodeNumber,
                    modelNumber = i.ModalNumber,
                    price = i.Price,
                    onHand = i.OnHand,
                    department = i.Department
                })
                .ToListAsync(ct);

            var links = results
                .Where(r => !string.IsNullOrWhiteSpace(r.name))
                .Select(r => new ChatEntityLinkDto
                {
                    EntityType = "item",
                    EntityId = r.itemId.ToString(),
                    Label = r.name!
                })
                .ToList();

            return ChatToolResult.OkWithLinks(
                JsonSerializer.Serialize(new { count = results.Count, items = results }),
                links);
        }
    }
}
