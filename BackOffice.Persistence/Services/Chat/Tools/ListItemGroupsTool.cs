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
    public class ListItemGroupsTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public ListItemGroupsTool(TenantDBContext db) { _db = db; }

        public override string Name => "list_item_groups";

        public override string Description =>
            "Lists item groups defined in the catalog. Item groups are collections used to group products for pricing or reporting. Returns group id, name, and parent.";

        public override string PermissionKey => "chatbot:tool.list_item_groups";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""query"": { ""type"": ""string"", ""description"": ""Optional partial group name."" },
            ""limit"": { ""type"": ""integer"", ""description"": ""Maximum groups (1-50). Default 20."", ""default"": 20, ""minimum"": 1, ""maximum"": 50 }
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

            var q0 = _db.Set<ItemGroup>()
                .AsNoTracking()
                .Where(g => g.Status == 0 || g.Status == null);

            if (!string.IsNullOrWhiteSpace(query))
            {
                var term = query.Trim();
                q0 = q0.Where(g => g.ItemGroupName != null && g.ItemGroupName.Contains(term));
            }

            var results = await q0
                .OrderBy(g => g.ItemGroupName)
                .Take(limit)
                .Select(g => new
                {
                    itemGroupId = g.ItemGroupID,
                    name = g.ItemGroupName,
                    parentId = g.ParentID
                })
                .ToListAsync(ct);

            return ChatToolResult.Ok(JsonSerializer.Serialize(new { count = results.Count, groups = results }));
        }
    }
}
