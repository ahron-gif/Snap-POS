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
    public class GetCustomersOweMoneyTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetCustomersOweMoneyTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_customers_owe_money";

        public override string Description =>
            "Returns customers with an open balance (owed to us), sorted by balance descending. Use for 'who owes us money', 'receivables', 'outstanding balances'.";

        public override string PermissionKey => "chatbot:tool.get_customers_owe_money";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""limit"": { ""type"": ""integer"", ""description"": ""Max rows (1-50). Default 20."", ""default"": 20, ""minimum"": 1, ""maximum"": 50 }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            int limit = 20;
            if (!string.IsNullOrWhiteSpace(argumentsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(argumentsJson);
                    var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                    if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                        limit = System.Math.Clamp(l.GetInt32(), 1, 50);
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            var results = await _db.Set<Customer>()
                .AsNoTracking()
                .Where(c => c.BalanceDoe.HasValue && c.BalanceDoe > 0)
                .OrderByDescending(c => c.BalanceDoe)
                .Take(limit)
                .Select(c => new
                {
                    customerId = c.CustomerID,
                    customerNo = c.CustomerNo,
                    firstName = c.FirstName,
                    lastName = c.LastName,
                    balanceDoe = c.BalanceDoe ?? 0m
                })
                .ToListAsync(ct);

            var total = results.Sum(r => r.balanceDoe);

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
                JsonSerializer.Serialize(new { count = results.Count, totalReceivables = total, customers = results }),
                links);
        }
    }
}
