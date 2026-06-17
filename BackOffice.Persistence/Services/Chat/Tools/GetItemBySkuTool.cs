using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Application.Services.Chat.Tools;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Services.Chat.Tools
{
    public class GetItemBySkuTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetItemBySkuTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_item_by_sku";

        public override string Description =>
            "Looks up a single item by its SKU / barcode / model number. Returns name, description, and price info.";

        public override string PermissionKey => "chatbot:tool.get_item_by_sku";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""sku"": { ""type"": ""string"", ""description"": ""The SKU, barcode, or model number of the item to look up."" }
          },
          ""required"": [""sku""]
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? sku = null;
            try
            {
                using var doc = JsonDocument.Parse(argumentsJson);
                if (doc.RootElement.TryGetProperty("sku", out var skuEl))
                {
                    sku = skuEl.GetString();
                }
                else if (doc.RootElement.TryGetProperty("args", out var argsEl)
                         && argsEl.TryGetProperty("sku", out var nestedSku))
                {
                    sku = nestedSku.GetString();
                }
            }
            catch (JsonException)
            {
                return ChatToolResult.Fail("Invalid JSON arguments.");
            }

            if (string.IsNullOrWhiteSpace(sku))
                return ChatToolResult.Fail("'sku' is required.");

            var item = await _db.Set<BackOffice.Domain.Entities.Tenant.ItemMainAndStoreGrid>()
                .AsNoTracking()
                .Where(i => i.BarcodeNumber == sku || i.ModalNumber == sku)
                .Select(i => new
                {
                    itemId = i.ItemID,
                    name = i.Name,
                    description = i.Description,
                    modelNumber = i.ModalNumber,
                    barcode = i.BarcodeNumber,
                    price = i.Price
                })
                .FirstOrDefaultAsync(ct);

            if (item == null)
                return ChatToolResult.Ok($"{{\"found\":false,\"sku\":\"{JsonEncodedText.Encode(sku)}\"}}");

            return ChatToolResult.Ok(JsonSerializer.Serialize(new { found = true, item }));
        }
    }
}
