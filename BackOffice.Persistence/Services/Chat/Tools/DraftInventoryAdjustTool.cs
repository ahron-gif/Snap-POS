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
    public class DraftInventoryAdjustTool : ChatToolBase
    {
        private readonly TenantDBContext _db;
        private readonly IChatActionDraftService _draftService;

        public DraftInventoryAdjustTool(TenantDBContext db, IChatActionDraftService draftService)
        {
            _db = db;
            _draftService = draftService;
        }

        public override string Name => "draft_inventory_adjust";

        public override string Description =>
            "Creates a DRAFT inventory adjustment (delta, can be positive or negative) for a specific item at a specific store. Does NOT apply the change — the user must confirm via the approval UI. Use for 'adjust SKU X by N units', 'write off N units of X'.";

        public override string PermissionKey => "chatbot:tool.draft_inventory_adjust";

        public override bool IsActionTool => true;

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""sku"": { ""type"": ""string"", ""description"": ""SKU / barcode / model number."" },
            ""storeId"": { ""type"": ""string"", ""description"": ""Store UUID. If omitted and the item exists in only one store, that store is used."" },
            ""qtyDelta"": { ""type"": ""number"", ""description"": ""Change in on-hand quantity. Use negative to reduce."" },
            ""reason"": { ""type"": ""string"", ""description"": ""Optional reason / note."" }
          },
          ""required"": [""sku"", ""qtyDelta""]
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? sku = null;
            string? storeIdStr = null;
            decimal? qtyDelta = null;
            string? reason = null;

            try
            {
                using var doc = JsonDocument.Parse(argumentsJson);
                var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                if (root.TryGetProperty("sku", out var s)) sku = s.GetString();
                if (root.TryGetProperty("storeId", out var st)) storeIdStr = st.GetString();
                if (root.TryGetProperty("qtyDelta", out var q) && q.ValueKind == JsonValueKind.Number) qtyDelta = q.GetDecimal();
                if (root.TryGetProperty("reason", out var r)) reason = r.GetString();
            }
            catch (JsonException)
            {
                return ChatToolResult.Fail("Invalid JSON arguments.");
            }

            if (string.IsNullOrWhiteSpace(sku))
                return ChatToolResult.Fail("'sku' is required.");
            if (qtyDelta == null || qtyDelta == 0)
                return ChatToolResult.Fail("'qtyDelta' is required and must be non-zero.");

            var item = await _db.Set<ItemMain>()
                .AsNoTracking()
                .Where(i => i.BarcodeNumber == sku || i.ModalNumber == sku)
                .Select(i => new { i.ItemID, i.Name, i.BarcodeNumber })
                .FirstOrDefaultAsync(ct);

            if (item == null)
                return ChatToolResult.Fail($"No item found with SKU '{sku}'.");

            System.Guid? storeId = null;
            if (!string.IsNullOrWhiteSpace(storeIdStr) && System.Guid.TryParse(storeIdStr, out var parsed))
                storeId = parsed;

            var stocks = await _db.Set<ItemStore>()
                .AsNoTracking()
                .Where(s => s.ItemNo == item.ItemID
                            && (storeId == null || s.StoreNo == storeId))
                .Select(s => new { itemStoreId = s.ItemStoreID, storeNo = s.StoreNo, currentOnHand = s.OnHand })
                .ToListAsync(ct);

            if (stocks.Count == 0)
                return ChatToolResult.Fail($"No item-store record found for SKU '{sku}'"
                    + (storeId == null ? "." : $" at store {storeId}."));

            if (stocks.Count > 1 && storeId == null)
                return ChatToolResult.Fail($"Item '{item.Name}' exists in {stocks.Count} stores. Please specify 'storeId'.");

            var target = stocks.First();
            var newOnHand = (target.currentOnHand ?? 0m) + qtyDelta.Value;

            var preview = new
            {
                action = "inventory_adjust",
                itemId = item.ItemID,
                itemName = item.Name,
                sku = item.BarcodeNumber,
                storeId = target.storeNo,
                currentOnHand = target.currentOnHand,
                qtyDelta = qtyDelta.Value,
                newOnHand,
                reason
            };

            var previewJson = JsonSerializer.Serialize(preview);
            var argsJson = JsonSerializer.Serialize(new
            {
                itemStoreId = target.itemStoreId,
                qtyDelta = qtyDelta.Value,
                reason
            });

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
