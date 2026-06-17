using System.Collections.Generic;
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
    public class GetTopCustomersTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public GetTopCustomersTool(TenantDBContext db) { _db = db; }

        public override string Name => "get_top_customers";

        public override string Description =>
            "Returns top customers by lifetime sales. Rendered as a bar chart. Use for 'best customers', 'top buyers', 'VIP customers'.";

        public override string PermissionKey => "chatbot:tool.get_top_customers";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""limit"": { ""type"": ""integer"", ""description"": ""Max customers (1-25). Default 10."", ""default"": 10, ""minimum"": 1, ""maximum"": 25 }
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
                        limit = System.Math.Clamp(l.GetInt32(), 1, 25);
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            var results = await (from s in _db.Set<CustomerTotalSaleView>().AsNoTracking()
                                 join c in _db.Set<Customer>().AsNoTracking() on s.CustomerID equals c.CustomerID
                                 where s.SumDebit != null
                                 orderby s.SumDebit descending
                                 select new
                                 {
                                     customerId = c.CustomerID,
                                     customerNo = c.CustomerNo,
                                     name = (c.FirstName ?? string.Empty) + " " + (c.LastName ?? string.Empty),
                                     totalSales = s.SumDebit ?? 0m
                                 })
                .Take(limit)
                .ToListAsync(ct);

            if (results.Count == 0)
            {
                return ChatToolResult.Ok(JsonSerializer.Serialize(new { count = 0, note = "No customer sales data." }));
            }

            var chart = new ChatVisualizationDto
            {
                Type = "bar",
                Horizontal = true,
                Title = "Top customers by lifetime sales",
                XAxisLabel = "Lifetime sales",
                Categories = results.Select(r => string.IsNullOrWhiteSpace(r.name.Trim()) ? (r.customerNo ?? "(no name)") : r.name.Trim()).ToList(),
                Series = { new ChatChartSeriesDto { Name = "Sales", Data = results.Select(r => r.totalSales).ToList() } }
            };

            var links = results
                .Select(r =>
                {
                    var label = r.name.Trim();
                    if (string.IsNullOrWhiteSpace(label)) label = r.customerNo ?? string.Empty;
                    return new ChatEntityLinkDto
                    {
                        EntityType = "customer",
                        EntityId = r.customerId.ToString(),
                        Label = label
                    };
                })
                .Where(l => !string.IsNullOrWhiteSpace(l.Label))
                .ToList();

            var resultChart = ChatToolResult.OkWithChart(
                JsonSerializer.Serialize(new { count = results.Count, customers = results }),
                chart);
            resultChart.Links = links;
            return resultChart;
        }
    }
}
