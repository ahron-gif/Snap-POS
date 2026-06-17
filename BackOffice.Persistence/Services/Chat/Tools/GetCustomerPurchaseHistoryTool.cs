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
    public class GetCustomerPurchaseHistoryTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetCustomerPurchaseHistoryTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_customer_purchase_history";

        public override string Description =>
            "Returns recent transactions for a specific customer. Use for 'show his purchases', 'customer X transaction history', 'what did customer Y buy'.";

        public override string PermissionKey => "chatbot:tool.get_customer_purchase_history";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""customerNo"": { ""type"": ""string"", ""description"": ""Customer number OR customer UUID."" },
            ""limit"": { ""type"": ""integer"", ""description"": ""Max transactions (1-25). Default 10."", ""default"": 10, ""minimum"": 1, ""maximum"": 25 }
          },
          ""required"": [""customerNo""]
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? customerNo = null;
            int limit = 10;
            try
            {
                using var doc = JsonDocument.Parse(argumentsJson);
                var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                if (root.TryGetProperty("customerNo", out var c))
                    customerNo = c.GetString();
                if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                    limit = System.Math.Clamp(l.GetInt32(), 1, 25);
            }
            catch (JsonException)
            {
                return ChatToolResult.Fail("Invalid JSON arguments.");
            }

            if (string.IsNullOrWhiteSpace(customerNo))
                return ChatToolResult.Fail("'customerNo' is required.");

            System.Guid.TryParse(customerNo, out var parsedGuid);

            var customer = await _db.Set<Customer>()
                .AsNoTracking()
                .Where(c => c.CustomerNo == customerNo || c.CustomerID == parsedGuid)
                .Select(c => new { c.CustomerID, c.CustomerNo, c.FirstName, c.LastName })
                .FirstOrDefaultAsync(ct);

            if (customer == null)
                return ChatToolResult.Ok(JsonSerializer.Serialize(new { found = false, customerNo }));

            var txns = await _db.Set<Transaction>()
                .AsNoTracking()
                .Where(t => t.CustomerID == customer.CustomerID && t.Status == 1)
                .OrderByDescending(t => t.StartSaleTime)
                .Take(limit)
                .Select(t => new
                {
                    transactionNo = t.TransactionNo,
                    saleTime = t.StartSaleTime,
                    amount = t.Debit,
                    storeId = t.StoreID
                })
                .ToListAsync(ct);

            return ChatToolResult.Ok(JsonSerializer.Serialize(new
            {
                found = true,
                customer = new { customer.CustomerID, customer.CustomerNo, name = $"{customer.FirstName} {customer.LastName}".Trim() },
                count = txns.Count,
                totalSpent = txns.Sum(t => t.amount ?? 0m),
                transactions = txns
            }));
        }
    }
}
