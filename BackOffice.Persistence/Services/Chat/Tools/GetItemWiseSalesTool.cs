using System;
using System.Globalization;
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
    public class GetItemWiseSalesTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetItemWiseSalesTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_item_wise_sales";

        public override string Description =>
            "Returns item-wise sales totals as a bar chart. Accepts EITHER a relative window ('days' back from today) OR explicit calendar dates ('fromDate' / 'toDate'). Use explicit dates when the user names a start date like 'from Apr 2024 to till date' or 'between 2025-11-12 and today'. The chart is rendered in the UI.";

        public override string PermissionKey => "chatbot:tool.get_item_wise_sales";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""days"": {
              ""type"": ""integer"",
              ""description"": ""Look-back window in days (1-3650). Ignored if fromDate is supplied. Default 30."",
              ""default"": 30,
              ""minimum"": 1,
              ""maximum"": 3650
            },
            ""fromDate"": {
              ""type"": ""string"",
              ""description"": ""Optional explicit start date in YYYY-MM-DD. When provided, overrides 'days'. Example: '2024-04-01' for 'April 2024'.""
            },
            ""toDate"": {
              ""type"": ""string"",
              ""description"": ""Optional explicit end date in YYYY-MM-DD. Pass 'today' or omit for the current date. Only meaningful together with 'fromDate'.""
            },
            ""limit"": {
              ""type"": ""integer"",
              ""description"": ""Maximum items to include in the chart (1-20). Default 10."",
              ""default"": 10,
              ""minimum"": 1,
              ""maximum"": 20
            }
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

                    if (root.TryGetProperty("days", out var daysEl) && daysEl.ValueKind == JsonValueKind.Number)
                        days = daysEl.GetInt32();
                    if (root.TryGetProperty("limit", out var limitEl) && limitEl.ValueKind == JsonValueKind.Number)
                        limit = limitEl.GetInt32();
                    if (root.TryGetProperty("fromDate", out var fd)) fromStr = fd.GetString();
                    if (root.TryGetProperty("toDate", out var td)) toStr = td.GetString();
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            if (limit < 1) limit = 1;
            if (limit > 20) limit = 20;

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
                                  group te by new { te.ItemID, te.Name } into g
                                  select new
                                  {
                                      itemId = g.Key.ItemID!.Value,
                                      name = g.Key.Name,
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

                var emptyPayload = JsonSerializer.Serialize(new
                {
                    windowLabel,
                    fromDate = fromDate.ToString("yyyy-MM-dd"),
                    toDate = toDate.ToString("yyyy-MM-dd"),
                    count = 0,
                    latestSaleUtc = latest,
                    note = latest == null
                        ? "No completed sales exist in this tenant."
                        : $"No sales between {fromDate:yyyy-MM-dd} and {toDate:yyyy-MM-dd}. Latest completed sale on record is {latest:yyyy-MM-dd}."
                });

                return ChatToolResult.Ok(emptyPayload);
            }

            var enriched = topItems
                .Select(t => new
                {
                    itemId = t.itemId,
                    label = string.IsNullOrWhiteSpace(t.name) ? t.itemId.ToString().Substring(0, 8) : t.name,
                    qtySold = t.qtySold
                })
                .ToList();

            var chart = new ChatVisualizationDto
            {
                Type = "bar",
                Horizontal = true,
                Title = $"Item-wise sales ({windowLabel})",
                XAxisLabel = "Quantity sold",
                YAxisLabel = "Item",
                Categories = enriched.Select(e => e.label).ToList(),
                Series =
                {
                    new ChatChartSeriesDto
                    {
                        Name = "Quantity Sold",
                        Data = enriched.Select(e => e.qtySold).ToList()
                    }
                }
            };

            var compactJson = JsonSerializer.Serialize(new
            {
                windowLabel,
                fromDate = fromDate.ToString("yyyy-MM-dd"),
                toDate = toDate.ToString("yyyy-MM-dd"),
                count = enriched.Count,
                items = enriched.Select(e => new { name = e.label, qtySold = e.qtySold })
            });

            return ChatToolResult.OkWithChart(compactJson, chart);
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
