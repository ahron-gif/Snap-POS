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
    public class ListDepartmentsTool : ChatToolBase
    {
        private readonly TenantDBContext _db;

        public ListDepartmentsTool(TenantDBContext db) { _db = db; }

        public override string Name => "list_departments";

        public override string Description =>
            "Lists departments (product categories) defined for the tenant. Returns department id, name, number, description, and parent department.";

        public override string PermissionKey => "chatbot:tool.list_departments";

        public override string JsonSchema => @"{
          ""type"": ""object"",
          ""properties"": {
            ""query"": { ""type"": ""string"", ""description"": ""Optional partial department name or number."" },
            ""limit"": { ""type"": ""integer"", ""description"": ""Maximum departments (1-50). Default 20."", ""default"": 20, ""minimum"": 1, ""maximum"": 50 }
          }
        }";

        public override async Task<ChatToolResult> ExecuteAsync(string argumentsJson, ChatToolContext context, CancellationToken ct)
        {
            string? query = null;
            int limit = 20;

            if (!string.IsNullOrWhiteSpace(argumentsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(argumentsJson);
                    var root = doc.RootElement.TryGetProperty("args", out var a) ? a : doc.RootElement;

                    if (root.TryGetProperty("query", out var q))
                        query = q.GetString();
                    if (root.TryGetProperty("limit", out var l) && l.ValueKind == JsonValueKind.Number)
                        limit = System.Math.Clamp(l.GetInt32(), 1, 50);
                }
                catch (JsonException)
                {
                    return ChatToolResult.Fail("Invalid JSON arguments.");
                }
            }

            var q0 = _db.Set<DepartmentStore>()
                .AsNoTracking()
                .Where(d => d.Status == 0 || d.Status == null);

            if (!string.IsNullOrWhiteSpace(query))
            {
                var term = query.Trim();
                q0 = q0.Where(d =>
                    (d.Name != null && d.Name.Contains(term)) ||
                    (d.DepartmentNo != null && d.DepartmentNo.Contains(term)));
            }

            var results = await q0
                .OrderBy(d => d.Name)
                .Take(limit)
                .Select(d => new
                {
                    departmentStoreId = d.DepartmentStoreID,
                    name = d.Name,
                    departmentNo = d.DepartmentNo,
                    description = d.Description,
                    parentDepartmentId = d.ParentDepartmentID,
                    storeId = d.StoreID
                })
                .ToListAsync(ct);

            return ChatToolResult.Ok(JsonSerializer.Serialize(new { count = results.Count, departments = results }));
        }
    }
}
