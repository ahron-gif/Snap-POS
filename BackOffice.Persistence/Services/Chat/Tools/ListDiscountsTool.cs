using System;
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
    public class ListDiscountsTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public ListDiscountsTool(TenantDBContext db) { _db = db; }

        public override string Name => "list_discounts";

        public override string Description =>
            "Lists discount / promotion definitions. By default returns only currently active ones (today between StartDate and EndDate). Returns name, type, percent, amount, and date window.";

        public override string PermissionKey => "chatbot:tool.list_discounts";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""query"": { ""type"": ""string"", ""description"": ""Optional partial discount name."" },
            ""onlyActive"": { ""type"": ""boolean"", ""description"": ""If true (default), only return discounts whose date window includes today."", ""default"": true },
            ""limit"": { ""type"": ""integer"", ""description"": ""Maximum discounts (1-50). Default 20."", ""default"": 20, ""minimum"": 1, ""maximum"": 50 }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? query = null;
            bool onlyActive = true;
            int limit = 20;

            if (!string.IsNullOrWhiteSpace(argumentsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(argumentsJson);
                    var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;

                    if (root.TryGetProperty("query", out var q))
                        query = q.GetString();
                    if (root.TryGetProperty("onlyActive", out var o) &&
                        (o.ValueKind == JsonValueKind.True || o.ValueKind == JsonValueKind.False))
                        onlyActive = o.GetBoolean();
                    if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                        limit = System.Math.Clamp(l.GetInt32(), 1, 50);
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            var today = DateTime.UtcNow.Date;

            var q0 = _db.Set<Discount>()
                .AsNoTracking()
                .Where(d => d.Status == 0 || d.Status == null);

            if (!string.IsNullOrWhiteSpace(query))
            {
                var term = query.Trim();
                q0 = q0.Where(d => d.Name != null && d.Name.Contains(term));
            }

            if (onlyActive)
            {
                q0 = q0.Where(d =>
                    (d.StartDate == null || d.StartDate <= today) &&
                    (d.EndDate == null || d.EndDate >= today));
            }

            var results = await q0
                .OrderBy(d => d.Name)
                .Take(limit)
                .Select(d => new
                {
                    discountId = d.DiscountID,
                    name = d.Name,
                    discountType = d.DiscountType,
                    percentsDiscount = d.PercentsDiscount,
                    amountDiscount = d.AmountDiscount,
                    startDate = d.StartDate,
                    endDate = d.EndDate,
                    minTotalSale = d.MinTotalSale
                })
                .ToListAsync(ct);

            return ChatToolResult.Ok(JsonSerializer.Serialize(new { count = results.Count, onlyActive, discounts = results }));
        }
    }
}
