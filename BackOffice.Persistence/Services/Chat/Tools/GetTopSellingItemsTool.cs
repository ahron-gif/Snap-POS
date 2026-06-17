using System;
using System.Globalization;
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
    public class GetTopSellingItemsTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetTopSellingItemsTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_top_selling_items";

        public override string Description =>
            "Returns the top N items ranked by total quantity sold. Accepts EITHER a relative window ('days') OR explicit 'fromDate' / 'toDate' (YYYY-MM-DD). Use explicit dates when the user names a specific range ('current month' => first day of this month to today; 'Apr 2024 to today'; 'last quarter'). Use this for 'which items are selling most', 'best sellers', 'top sellers this month'.";

        public override string PermissionKey => "chatbot:tool.get_top_selling_items";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""days"": { ""type"": ""integer"", ""description"": ""Look-back window in days (1-3650). Ignored if fromDate is supplied. Default 30."", ""default"": 30, ""minimum"": 1, ""maximum"": 3650 },
            ""fromDate"": { ""type"": ""string"", ""description"": ""Optional explicit start date YYYY-MM-DD. For 'current month' pass the first day of the current month."" },
            ""toDate"":   { ""type"": ""string"", ""description"": ""Optional explicit end date YYYY-MM-DD. Pass 'today' or omit for current date."" },
            ""limit"": { ""type"": ""integer"", ""description"": ""Maximum items (1-25). Default 10."", ""default"": 10, ""minimum"": 1, ""maximum"": 25 }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            int days = 30;
            int limit = 10;
            string? fromStr = null;
            string? toStr = null;

            if (!string.IsNullOrWhiteSpace(argumentsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(argumentsJson);
                    var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                    if (root.TryGetProperty("days", out var d) && d.ValueKind == JsonValueKind.Number)
                        days = d.GetInt32();
                    if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                        limit = l.GetInt32();
                    if (root.TryGetProperty("fromDate", out var fd)) fromStr = fd.GetString();
                    if (root.TryGetProperty("toDate", out var td)) toStr = td.GetString();
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            if (limit < 1) limit = 1;
            if (limit > 25) limit = 25;

            DateTime fromDate;
            DateTime toDate;
            string windowLabel;

            if (!string.IsNullOrWhiteSpace(fromStr))
            {
                if (!TryParseDate(fromStr, out fromDate))
                    return ChatToolResult.Fail("'fromDate' must be YYYY-MM-DD.");
                if (string.IsNullOrWhiteSpace(toStr) || toStr.Equals("today", StringComparison.OrdinalIgnoreCase))
                    toDate = DateTime.UtcNow.Date;
                else if (!TryParseDate(toStr, out toDate))
                    return ChatToolResult.Fail("'toDate' must be YYYY-MM-DD or 'today'.");
                if (toDate < fromDate)
                    return ChatToolResult.Fail("'toDate' must be >= 'fromDate'.");
                windowLabel = $"{fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}";
            }
            else
            {
                if (days < 1) days = 1;
                if (days > 3650) days = 3650;
                fromDate = DateTime.UtcNow.AddDays(-days);
                toDate = DateTime.UtcNow;
                windowLabel = $"last {days} days";
            }

            var endExclusive = toDate.AddDays(1);

            var topItems = await (from te in _db.Set<TransactionEntryItem>().AsNoTracking()
                                  join t in _db.Set<Transaction>().AsNoTracking()
                                      on te.TransactionID equals t.TransactionID
                                  where t.Status == 1
                                        && t.StartSaleTime != null
                                        && t.StartSaleTime >= fromDate
                                        && t.StartSaleTime < endExclusive
                                        && te.ItemID != null
                                        && te.QTY != null
                                  group te by new { te.ItemID, te.Name, te.BarcodeNumber, te.ModalNumber } into g
                                  select new
                                  {
                                      itemId = g.Key.ItemID!.Value,
                                      name = g.Key.Name,
                                      sku = g.Key.BarcodeNumber,
                                      modelNumber = g.Key.ModalNumber,
                                      qtySold = g.Sum(x => x.QTY ?? 0m)
                                  })
                .OrderByDescending(x => x.qtySold)
                .Take(limit)
                .ToListAsync(ct);

            if (topItems.Count == 0)
            {
                var latest = await _db.Set<Transaction>().AsNoTracking()
                    .Where(t => t.Status == 1 && t.StartSaleTime != null)
                    .MaxAsync(t => (DateTime?)t.StartSaleTime, ct);

                return ChatToolResult.Ok(JsonSerializer.Serialize(new
                {
                    windowLabel,
                    fromDate = fromDate.ToString("yyyy-MM-dd"),
                    toDate = toDate.ToString("yyyy-MM-dd"),
                    count = 0,
                    latestSaleUtc = latest,
                    note = latest == null
                        ? "No completed sales exist in this tenant."
                        : $"No sales between {fromDate:yyyy-MM-dd} and {toDate:yyyy-MM-dd}. Latest completed sale on record is {latest:yyyy-MM-dd}.",
                    items = Array.Empty<object>()
                }));
            }

            var ranked = topItems
                .Select((t, idx) => new
                {
                    rank = idx + 1,
                    itemId = t.itemId,
                    name = t.name,
                    sku = t.sku,
                    modelNumber = t.modelNumber,
                    qtySold = t.qtySold
                })
                .ToList();

            return ChatToolResult.Ok(JsonSerializer.Serialize(new
            {
                windowLabel,
                fromDate = fromDate.ToString("yyyy-MM-dd"),
                toDate = toDate.ToString("yyyy-MM-dd"),
                count = ranked.Count,
                items = ranked
            }));
        }

        private static bool TryParseDate(string? s, out DateTime date)
        {
            date = default;
            if (string.IsNullOrWhiteSpace(s)) return false;
            var formats = new[] { "yyyy-MM-dd", "yyyy/MM/dd", "MM/dd/yyyy", "M/d/yyyy", "d/M/yyyy", "yyyy-MM" };
            if (DateTime.TryParseExact(s.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out date))
            {
                date = date.Date;
                return true;
            }
            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out date))
            {
                date = date.Date;
                return true;
            }
            return false;
        }
    }
}
