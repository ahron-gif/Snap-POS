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
    public class GetSalesByCashierTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetSalesByCashierTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_sales_by_cashier";

        public override string Description =>
            "Returns sales totals grouped by cashier (the user who created the transaction). Bar chart. Accepts 'days' OR 'fromDate'/'toDate'. Use for 'sales by cashier', 'top cashiers', 'who rang up the most'.";

        public override string PermissionKey => "chatbot:tool.get_sales_by_cashier";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""days"": { ""type"": ""integer"", ""description"": ""Look-back window. Ignored if fromDate is supplied. Default 30."", ""default"": 30, ""minimum"": 1, ""maximum"": 3650 },
            ""fromDate"": { ""type"": ""string"", ""description"": ""Optional start YYYY-MM-DD."" },
            ""toDate"":   { ""type"": ""string"", ""description"": ""Optional end YYYY-MM-DD or 'today'."" }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            JsonElement root;
            try
            {
                using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(argumentsJson) ? "{}" : argumentsJson);
                root = doc.RootElement.TryGetProperty("args", out var a) ? a.Clone() : doc.RootElement.Clone();
            }
            catch (JsonException) { return ChatToolResult.Fail("Invalid JSON arguments."); }

            if (!ChatDateRange.TryResolve(root, 30, 1, 3650, out var range, out var err))
                return ChatToolResult.Fail(err!);

            var perUser = await _db.Set<Transaction>()
                .AsNoTracking()
                .Where(t => t.Status == 1
                            && t.StartSaleTime >= range.FromDate
                            && t.StartSaleTime < range.EndExclusive
                            && t.UserCreated != null)
                .GroupBy(t => t.UserCreated!.Value)
                .Select(g => new { userId = g.Key, total = g.Sum(x => x.Debit ?? 0m), count = g.Count() })
                .OrderByDescending(x => x.total)
                .Take(10)
                .ToListAsync(ct);

            if (perUser.Count == 0)
            {
                return ChatToolResult.Ok(JsonSerializer.Serialize(new
                {
                    windowLabel = range.Label, count = 0,
                    note = $"No sales between {range.FromDate:yyyy-MM-dd} and {range.ToDate:yyyy-MM-dd}."
                }));
            }

            var userIds = perUser.Select(p => p.userId).ToList();
            var users = await _db.Set<WebUser>()
                .AsNoTracking()
                .Where(u => userIds.Contains(u.UserId))
                .Select(u => new { u.UserId, u.UserName, u.UserFName, u.UserLName })
                .ToListAsync(ct);

            var userLookup = users.ToDictionary(u => u.UserId);

            var enriched = perUser.Select(p =>
            {
                userLookup.TryGetValue(p.userId, out var u);
                var name = u == null
                    ? p.userId.ToString().Substring(0, 8)
                    : (!string.IsNullOrWhiteSpace(u.UserFName) || !string.IsNullOrWhiteSpace(u.UserLName)
                        ? $"{u.UserFName} {u.UserLName}".Trim()
                        : (u.UserName ?? p.userId.ToString().Substring(0, 8)));
                return new { userId = p.userId, name, total = p.total, count = p.count };
            }).ToList();

            var chart = new ChatVisualizationDto
            {
                Type = "bar",
                Horizontal = true,
                Title = $"Sales by cashier ({range.Label})",
                XAxisLabel = "Total sales",
                Categories = enriched.Select(e => e.name).ToList(),
                Series = { new ChatChartSeriesDto { Name = "Sales", Data = enriched.Select(e => e.total).ToList() } }
            };

            return ChatToolResult.OkWithChart(
                JsonSerializer.Serialize(new { windowLabel = range.Label, count = enriched.Count, cashiers = enriched }),
                chart);
        }
    }
}
