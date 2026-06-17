using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Application.Services.Chat.Tools;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Services.Chat.Tools
{
    public class SearchCustomersTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public SearchCustomersTool(TenantDBContext db) { _db = db; }

        public override string Name => "search_customers";

        public override string Description =>
            "Searches customers by partial name or customer number. Returns up to 10 matches with name and customer number.";

        public override string PermissionKey => "chatbot:tool.search_customers";

        public override string JsonSchema => @"{
  ""type"": ""object"",
  ""properties"": {
    ""query"": { ""type"": ""string"", ""description"": ""Partial name, last name, or customer number to match."" },
    ""limit"": { ""type"": ""integer"", ""description"": ""Maximum results (1-10). Default 5."", ""default"": 5 }
  },
  ""required"": [""query""]
}";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? query = null;
            int limit = 5;
            try
            {
                using var doc = JsonDocument.Parse(argumentsJson);
                var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;

                if (root.TryGetProperty("query", out var q))
                    query = q.GetString();
                if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                    limit = System.Math.Clamp(l.GetInt32(), 1, 10);
            }
            catch (JsonException)
            {
                return ChatToolResult.Fail("Invalid JSON arguments.");
            }

            if (string.IsNullOrWhiteSpace(query))
                return ChatToolResult.Fail("'query' is required.");

            var term = query.Trim();

            var results = await _db.Set<BackOffice.Domain.Entities.Tenant.Customer>()
                .AsNoTracking()
                .Where(c =>
                    (c.FirstName != null && c.FirstName.Contains(term)) ||
                    (c.LastName != null && c.LastName.Contains(term)) ||
                    (c.CustomerNo != null && c.CustomerNo.Contains(term)))
                .OrderBy(c => c.LastName)
                .Take(limit)
                .Select(c => new
                {
                    customerId = c.CustomerID,
                    customerNo = c.CustomerNo,
                    firstName = c.FirstName,
                    lastName = c.LastName
                })
                .ToListAsync(ct);

            var links = results
                .Select(r =>
                {
                    var label = $"{r.firstName} {r.lastName}".Trim();
                    if (string.IsNullOrWhiteSpace(label)) label = r.customerNo ?? string.Empty;
                    return new ChatEntityLinkDto
                    {
                        EntityType = "customer",
                        EntityId = r.customerId.ToString(),
                        Label = label
                    };
                })
                .Where(l => !string.IsNullOrWhiteSpace(l.Label))
                .ToList();

            return ChatToolResult.OkWithLinks(
                JsonSerializer.Serialize(new { count = results.Count, results }),
                links);
        }
    }
}
