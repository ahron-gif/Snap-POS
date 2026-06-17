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
    public class GetOpenPurchaseOrdersTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetOpenPurchaseOrdersTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_open_purchase_orders";

        public override string Description =>
            "Returns currently open purchase orders (not yet closed). Use for 'open POs', 'pending purchase orders', 'what's on order'.";

        public override string PermissionKey => "chatbot:tool.get_open_purchase_orders";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""limit"": { ""type"": ""integer"", ""description"": ""Max POs (1-50). Default 20."", ""default"": 20, ""minimum"": 1, ""maximum"": 50 }
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

            var results = await (from p in _db.Set<PurchaseOrder>().AsNoTracking()
                                 where p.POStatus == 0 || p.POStatus == 1
                                 join s in _db.Set<Supplier>().AsNoTracking() on p.SupplierNo equals s.SupplierID into sj
                                 from s in sj.DefaultIfEmpty()
                                 orderby p.PurchaseOrderDate descending
                                 select new
                                 {
                                     poId = p.PurchaseOrderId,
                                     poNo = p.PoNo,
                                     supplierName = s != null ? s.Name : null,
                                     status = p.POStatus,
                                     total = p.GrandTotal,
                                     orderDate = p.PurchaseOrderDate,
                                     expectedDate = p.ExpirationDate
                                 })
                .Take(limit)
                .ToListAsync(ct);

            return ChatToolResult.Ok(JsonSerializer.Serialize(new
            {
                count = results.Count,
                totalValue = results.Sum(r => r.total ?? 0m),
                purchaseOrders = results
            }));
        }
    }
}
