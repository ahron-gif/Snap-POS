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
    public class ListManufacturersTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public ListManufacturersTool(TenantDBContext db) { _db = db; }

        public override string Name => "list_manufacturers";

        public override string Description =>
            "Lists manufacturers (brands) defined for the tenant. Returns manufacturer id, name, and manufacturer number.";

        public override string PermissionKey => "chatbot:tool.list_manufacturers";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""query"": { ""type"": ""string"", ""description"": ""Optional partial manufacturer name or number."" },
            ""limit"": { ""type"": ""integer"", ""description"": ""Maximum manufacturers (1-50). Default 20."", ""default"": 20, ""minimum"": 1, ""maximum"": 50 }
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

            var q0 = _db.Set<Manufacturer>()
                .AsNoTracking()
                .Where(m => m.Status == 0 || m.Status == null);

            if (!string.IsNullOrWhiteSpace(query))
            {
                var term = query.Trim();
                q0 = q0.Where(m =>
                    m.ManufacturerName.Contains(term) ||
                    (m.ManufacturerNo != null && m.ManufacturerNo.Contains(term)));
            }

            var results = await q0
                .OrderBy(m => m.ManufacturerName)
                .Take(limit)
                .Select(m => new
                {
                    manufacturerId = m.ManufacturerID,
                    name = m.ManufacturerName,
                    manufacturerNo = m.ManufacturerNo
                })
                .ToListAsync(ct);

            return ChatToolResult.Ok(JsonSerializer.Serialize(new { count = results.Count, manufacturers = results }));
        }
    }
}
