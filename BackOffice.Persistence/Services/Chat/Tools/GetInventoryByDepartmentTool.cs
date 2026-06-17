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
    public class GetInventoryByDepartmentTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetInventoryByDepartmentTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_inventory_by_department";

        public override string Description =>
            "Returns total on-hand inventory quantity rolled up by department. Rendered as a bar chart. Use for 'inventory by department', 'stock breakdown', 'which department has most stock'.";

        public override string PermissionKey => "chatbot:tool.get_inventory_by_department";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""limit"": { ""type"": ""integer"", ""description"": ""Max departments to show (1-20). Default 10."", ""default"": 10, ""minimum"": 1, ""maximum"": 20 }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            int limit = 10;
            if (!string.IsNullOrWhiteSpace(argumentsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(argumentsJson);
                    var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;
                    if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                        limit = System.Math.Clamp(l.GetInt32(), 1, 20);
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            var results = await _db.Set<ItemMainAndStoreGrid>()
                .AsNoTracking()
                .Where(i => (i.Status == 0 || i.Status == null) && i.Department != null)
                .GroupBy(i => i.Department)
                .Select(g => new
                {
                    department = g.Key,
                    totalOnHand = g.Sum(x => x.OnHand),
                    itemCount = g.Count()
                })
                .OrderByDescending(x => x.totalOnHand)
                .Take(limit)
                .ToListAsync(ct);

            if (results.Count == 0)
            {
                return ChatToolResult.Ok(JsonSerializer.Serialize(new { count = 0, note = "No inventory found." }));
            }

            var chart = new ChatVisualizationDto
            {
                Type = "bar",
                Horizontal = true,
                Title = "Inventory by department (on-hand units)",
                XAxisLabel = "Units on hand",
                Categories = results.Select(r => r.department ?? "(none)").ToList(),
                Series =
                {
                    new ChatChartSeriesDto
                    {
                        Name = "Units on hand",
                        Data = results.Select(r => r.totalOnHand).ToList()
                    }
                }
            };

            return ChatToolResult.OkWithChart(
                JsonSerializer.Serialize(new { count = results.Count, departments = results }),
                chart);
        }
    }
}
