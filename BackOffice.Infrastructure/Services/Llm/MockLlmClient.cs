using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat.Llm;
using BackOffice.Application.Interfaces.Services.Chat;
using Microsoft.Extensions.Logging;

namespace BackOffice.Infrastructure.Services.Llm
{
    public class MockLlmClient : ILlmClient
    {
        private readonly ILogger<MockLlmClient> _logger;

        public MockLlmClient(ILogger<MockLlmClient> logger)
        {
            _logger = logger;
        }

        public Task<LlmCompletionResponse> CompleteAsync(LlmCompletionRequest request, CancellationToken ct = default)
        {
            var lastUser = request.Messages.LastOrDefault(m => m.Role == "user");
            var lastContent = lastUser?.Content ?? string.Empty;
            var lowered = lastContent.ToLowerInvariant();

            var hasToolResult = request.Messages.Any(m => m.Role == "tool");

            _logger.LogInformation(
                "MockLlmClient invoked. UserText={Text} ToolsAvailable={ToolCount} HasToolResult={HasToolResult}",
                Trim(lastContent, 120), request.Tools.Count, hasToolResult);

            if (hasToolResult)
            {
                return Task.FromResult(BuildFinalAnswer(request));
            }

            var response = new LlmCompletionResponse
            {
                ModelName = "mock-llm-v1",
                InputTokens = EstimateTokens(request),
                OutputTokens = 60,
                StopReason = "end_turn"
            };

            if (TryMatchTool(lowered, request.Tools, out var toolName, out var argsJson) &&
                !string.IsNullOrEmpty(toolName))
            {
                response.ToolCalls.Add(new LlmToolCall
                {
                    Id = $"mock_call_{Guid.NewGuid():N}",
                    Name = toolName!,
                    ArgumentsJson = argsJson
                });
                response.TextContent = null;
                response.StopReason = "tool_use";
                return Task.FromResult(response);
            }

            response.TextContent = BuildGreetingOrHelp(lastContent, request.Tools);
            return Task.FromResult(response);
        }

        private static bool TryMatchTool(
            string lowered,
            IReadOnlyList<LlmToolSchema> tools,
            out string? toolName,
            out string argsJson)
        {
            toolName = null;
            argsJson = "{}";

            var hasItemTool = tools.Any(t => t.Name == "get_item_by_sku");
            var hasCustTool = tools.Any(t => t.Name == "search_customers");

            if (hasItemTool && (lowered.Contains("sku") || lowered.Contains("item") || lowered.Contains("barcode")))
            {
                var sku = ExtractFirstNumberOrCode(lowered) ?? "12345";
                toolName = "get_item_by_sku";
                argsJson = JsonSerializer.Serialize(new { sku });
                return true;
            }

            if (hasCustTool && (lowered.Contains("customer") || lowered.Contains("client") || lowered.Contains("buyer")))
            {
                var query = ExtractNameLike(lowered) ?? "smith";
                toolName = "search_customers";
                argsJson = JsonSerializer.Serialize(new { query, limit = 5 });
                return true;
            }

            return false;
        }

        private static LlmCompletionResponse BuildFinalAnswer(LlmCompletionRequest request)
        {
            var lastTool = request.Messages.LastOrDefault(m => m.Role == "tool");
            var toolResult = lastTool?.ToolResult ?? "{}";
            var summary = SummarizeToolResult(toolResult);

            return new LlmCompletionResponse
            {
                ModelName = "mock-llm-v1",
                InputTokens = EstimateTokens(request),
                OutputTokens = 80,
                StopReason = "end_turn",
                TextContent = summary
            };
        }

        private static string SummarizeToolResult(string toolResultJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(toolResultJson);
                var root = doc.RootElement;

                if (root.TryGetProperty("found", out var found) && found.ValueKind == JsonValueKind.False)
                {
                    return "I could not find a matching item. Double-check the SKU or barcode and try again.";
                }

                if (root.TryGetProperty("item", out var item))
                {
                    var name = item.TryGetProperty("name", out var n) ? n.GetString() : "(no name)";
                    var model = item.TryGetProperty("modelNumber", out var mn) ? mn.GetString() : "-";
                    var barcode = item.TryGetProperty("barcode", out var bc) ? bc.GetString() : "-";
                    return $"**Found the item:**\n\n- Name: {name}\n- Model: {model}\n- Barcode: {barcode}\n\n*(Mock response — no real LLM was used.)*";
                }

                if (root.TryGetProperty("results", out var results) && results.ValueKind == JsonValueKind.Array)
                {
                    var count = results.GetArrayLength();
                    if (count == 0)
                        return "No customers matched that search.";

                    var lines = new List<string>();
                    foreach (var c in results.EnumerateArray().Take(5))
                    {
                        var first = c.TryGetProperty("firstName", out var f) ? f.GetString() : "";
                        var last = c.TryGetProperty("lastName", out var l) ? l.GetString() : "";
                        var no = c.TryGetProperty("customerNo", out var cn) ? cn.GetString() : "-";
                        lines.Add($"- {first} {last} (#{no})");
                    }
                    return $"**Found {count} customer(s):**\n\n{string.Join("\n", lines)}\n\n*(Mock response — no real LLM was used.)*";
                }
            }
            catch (JsonException)
            {
            }

            return "Here is the data I retrieved.\n\n```\n" + Trim(toolResultJson, 500) + "\n```\n\n*(Mock response — no real LLM was used.)*";
        }

        private static string BuildGreetingOrHelp(string userText, IReadOnlyList<LlmToolSchema> tools)
        {
            var toolNames = string.Join(", ", tools.Select(t => $"`{t.Name}`"));
            if (string.IsNullOrWhiteSpace(toolNames))
                toolNames = "(none available for your role)";

            if (userText.Length < 3)
            {
                return "Hi! I'm the mock assistant. Try asking about an item, a customer, or type a question containing \"sku\" or \"customer\".";
            }

            return $"**Mock Assistant**\n\nI received: \"{Trim(userText, 120)}\"\n\nI do not have a matching tool for that question. Try wording it with keywords like **SKU**, **item**, or **customer** to trigger a tool call.\n\nAvailable tools: {toolNames}";
        }

        private static string? ExtractFirstNumberOrCode(string text)
        {
            var tokens = text.Split(new[] { ' ', ',', '.', '?', '!', ':', ';' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var t in tokens)
            {
                if (t.Length >= 3 && t.Any(char.IsDigit))
                    return t;
            }
            return null;
        }

        private static string? ExtractNameLike(string text)
        {
            var tokens = text.Split(new[] { ' ', ',', '.', '?', '!' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var t in tokens)
            {
                if (t.Length >= 3 && t.All(char.IsLetter))
                {
                    var l = t.ToLowerInvariant();
                    if (l is "the" or "how" or "many" or "customer" or "customers" or "find" or "show" or "search" or "get" or "any")
                        continue;
                    return t;
                }
            }
            return null;
        }

        private static int EstimateTokens(LlmCompletionRequest request)
        {
            var chars = request.SystemPrompt.Length;
            foreach (var m in request.Messages)
                chars += (m.Content?.Length ?? 0) + (m.ToolResult?.Length ?? 0);
            return Math.Max(1, chars / 4);
        }

        private static string Trim(string input, int max)
        {
            if (string.IsNullOrEmpty(input) || input.Length <= max) return input ?? string.Empty;
            return input.Substring(0, max) + "...";
        }
    }
}
