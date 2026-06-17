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
    public class DraftPriceChangeTool : ChatToolBase
    {
        private readonly TenantDBContext _db;
        private readonly IChatActionDraftService _draftService;

        public DraftPriceChangeTool(TenantDBContext db, IChatActionDraftService draftService)
        {
            _db = db;
            _draftService = draftService;
        }

        public override string Name => "draft_price_change";

        public override string Description =>
            "Creates a DRAFT price change for an item across all stores. Does NOT apply the change — the user must confirm via the approval UI. Use for 'change price of SKU X to Y', 'update price of item X'.";

        public override string PermissionKey => "chatbot:tool.draft_price_change";

        public override bool IsActionTool => true;

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""sku"": { ""type"": ""string"", ""description"": ""SKU or barcode of the item."" },
            ""newPrice"": { ""type"": ""number"", ""description"": ""New sell price."", ""minimum"": 0 }
          },
          ""required"": [""sku"", ""newPrice""]
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? sku = null;
            decimal? newPrice = null;
            try
            {
                using var doc = JsonDocument.Parse(argumentsJson);
                var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                if (root.TryGetProperty("sku", out var s))
                    sku = s.GetString();
                if (root.TryGetProperty("newPrice", out var p) && p.ValueKind == JsonValueKind.Number)
                    newPrice = p.GetDecimal();
            }
            catch (JsonException)
            {
                return ChatToolResult.Fail("Invalid JSON arguments.");
            }

            if (string.IsNullOrWhiteSpace(sku))
                return ChatToolResult.Fail("'sku' is required.");
            if (newPrice == null || newPrice < 0)
                return ChatToolResult.Fail("'newPrice' is required and must be >= 0.");

            var item = await _db.Set<ItemMain>()
                .AsNoTracking()
                .Where(i => i.BarcodeNumber == sku || i.ModalNumber == sku)
                .Select(i => new { i.ItemID, i.Name, i.BarcodeNumber })
                .FirstOrDefaultAsync(ct);

            if (item == null)
                return ChatToolResult.Fail($"No item found with SKU '{sku}'.");

            var currentPrices = await _db.Set<ItemStore>()
                .AsNoTracking()
                .Where(s => s.ItemNo == item.ItemID)
                .Select(s => new { storeNo = s.StoreNo, currentPrice = s.Price })
                .ToListAsync(ct);

            var preview = new
            {
                action = "price_change",
                itemId = item.ItemID,
                itemName = item.Name,
                sku = item.BarcodeNumber,
                newPrice = newPrice.Value,
                affectedStores = currentPrices.Count,
                currentPrices
            };

            var previewJson = JsonSerializer.Serialize(preview);
            var argsJson = JsonSerializer.Serialize(new { itemId = item.ItemID, newPrice = newPrice.Value });

            var draft = await _draftService.CreateDraftAsync(
                context.UserId,
                context.ConversationId,
                Name,
                PermissionKey,
                argsJson,
                previewJson,
                ct);

            return ChatToolResult.Draft(previewJson, draft.DraftGuid.ToString());
        }
    }
}
