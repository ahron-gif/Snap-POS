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
    public class ListSuppliersTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public ListSuppliersTool(TenantDBContext db) { _db = db; }

        public override string Name => "list_suppliers";

        public override string Description =>
            "Lists active suppliers/vendors. Returns id, name, supplier number, contact, email. Use for 'list suppliers', 'find supplier X', 'who are our vendors'.";

        public override string PermissionKey => "chatbot:tool.list_suppliers";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""query"": { ""type"": ""string"", ""description"": ""Optional partial supplier name or number."" },
            ""limit"": { ""type"": ""integer"", ""description"": ""Max suppliers (1-50). Default 20."", ""default"": 20, ""minimum"": 1, ""maximum"": 50 }
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

            var q0 = _db.Set<Supplier>().AsNoTracking()
                .Where(s => s.Status == 0 || s.Status == null);

            if (!string.IsNullOrWhiteSpace(query))
            {
                var term = query.Trim();
                q0 = q0.Where(s =>
                    (s.Name != null && s.Name.Contains(term)) ||
                    (s.SupplierNo != null && s.SupplierNo.Contains(term)));
            }

            var results = await q0
                .OrderBy(s => s.Name)
                .Take(limit)
                .Select(s => new
                {
                    supplierId = s.SupplierID,
                    name = s.Name,
                    supplierNo = s.SupplierNo,
                    contact = s.ContactName,
                    email = s.EmailAddress
                })
                .ToListAsync(ct);

            var links = results
                .Where(r => !string.IsNullOrWhiteSpace(r.name))
                .Select(r => new ChatEntityLinkDto
                {
                    EntityType = "supplier",
                    EntityId = r.supplierId.ToString(),
                    Label = r.name!
                })
                .ToList();

            return ChatToolResult.OkWithLinks(
                JsonSerializer.Serialize(new { count = results.Count, suppliers = results }),
                links);
        }
    }
}
