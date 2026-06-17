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
    public class CheckItemStockTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public CheckItemStockTool(TenantDBContext db) { _db = db; }

        public override string Name => "check_item_stock";

        public override string Description =>
            "Looks up current on-hand quantity for a specific SKU across all stores. Use for 'how many of X do we have', 'stock of SKU 123'.";

        public override string PermissionKey => "chatbot:tool.check_item_stock";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""sku"": { ""type"": ""string"", ""description"": ""SKU, barcode, or model number."" }
          },
          ""required"": [""sku""]
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? sku = null;
            try
            {
                using var doc = JsonDocument.Parse(argumentsJson);
                var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                if (root.TryGetProperty("sku", out var s))
                    sku = s.GetString();
            }
            catch (JsonException)
            {
                return ChatToolResult.Fail("Invalid JSON arguments.");
            }

            if (string.IsNullOrWhiteSpace(sku))
                return ChatToolResult.Fail("'sku' is required.");

            var item = await _db.Set<ItemMain>()
                .AsNoTracking()
                .Where(i => i.BarcodeNumber == sku || i.ModalNumber == sku)
                .Select(i => new { i.ItemID, i.Name, i.BarcodeNumber, i.ModalNumber })
                .FirstOrDefaultAsync(ct);

            if (item == null)
                return ChatToolResult.Ok(JsonSerializer.Serialize(new { found = false, sku }));

            var stores = await (from s in _db.Set<ItemStore>().AsNoTracking()
                                join st in _db.Set<Store>().AsNoTracking() on s.StoreNo equals st.StoreID
                                where s.ItemNo == item.ItemID
                                select new
                                {
                                    storeId = st.StoreID,
                                    storeName = st.StoreName,
                                    storeNumber = st.StoreNumber,
                                    onHand = s.OnHand ?? 0m,
                                    onOrder = s.OnOrder ?? 0m,
                                    reorderPoint = s.ReorderPoint ?? 0m,
                                    price = s.Price
                                })
                .ToListAsync(ct);

            var total = stores.Sum(s => s.onHand);

            return ChatToolResult.Ok(JsonSerializer.Serialize(new
            {
                found = true,
                item = new { item.ItemID, item.Name, sku = item.BarcodeNumber, modelNumber = item.ModalNumber },
                totalOnHand = total,
                storeCount = stores.Count,
                stores
            }));
        }
    }
}
