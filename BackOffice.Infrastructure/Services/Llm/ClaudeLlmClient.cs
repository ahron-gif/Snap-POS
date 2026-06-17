using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat.Llm;
using BackOffice.Application.Interfaces.Services.Chat;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BackOffice.Infrastructure.Services.Llm
{
    public class ClaudeLlmClient : ILlmClient
    {
        private readonly HttpClient _http;
        private readonly ClaudeOptions _options;
        private readonly ILogger<ClaudeLlmClient> _logger;

        public ClaudeLlmClient(
            HttpClient http,
            IOptions<ClaudeOptions> options,
            ILogger<ClaudeLlmClient> logger)
        {
            _http = http;
            _options = options.Value;
            _logger = logger;

            _http.BaseAddress = new Uri(_options.BaseUrl.TrimEnd('/') + "/");
            _http.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
            _http.DefaultRequestHeaders.Remove("x-api-key");
            _http.DefaultRequestHeaders.Remove("anthropic-version");
            _http.DefaultRequestHeaders.Add("x-api-key", _options.ApiKey);
            _http.DefaultRequestHeaders.Add("anthropic-version", _options.AnthropicVersion);
            _http.DefaultRequestHeaders.Accept.Clear();
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        public async Task<LlmCompletionResponse> CompleteAsync(LlmCompletionRequest request, CancellationToken ct = default)
        {
            var body = BuildRequestBody(request);
            var json = JsonSerializer.Serialize(body);

            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var response = await _http.PostAsync("v1/messages", content, ct);

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "Claude API call failed. Status={Status} Body={Body}",
                    response.StatusCode, responseJson);
                throw new InvalidOperationException($"Claude API returned {(int)response.StatusCode}: {responseJson}");
            }

            return ParseResponse(responseJson);
        }

        private object BuildRequestBody(LlmCompletionRequest request)
        {
            var messages = new List<object>();
            foreach (var m in request.Messages)
            {
                if (m.Role == "user")
                {
                    messages.Add(new { role = "user", content = m.Content ?? string.Empty });
                }
                else if (m.Role == "assistant")
                {
                    var parts = new List<object>();
                    if (!string.IsNullOrEmpty(m.Content))
                        parts.Add(new { type = "text", text = m.Content });
                    if (m.ToolCalls != null)
                    {
                        foreach (var tc in m.ToolCalls)
                        {
                            parts.Add(new
                            {
                                type = "tool_use",
                                id = tc.Id,
                                name = tc.Name,
                                input = ParseInput(tc.ArgumentsJson)
                            });
                        }
                    }
                    messages.Add(new { role = "assistant", content = parts });
                }
                else if (m.Role == "tool")
                {
                    messages.Add(new
                    {
                        role = "user",
                        content = new[]
                        {
                            new
                            {
                                type = "tool_result",
                                tool_use_id = m.ToolCallId,
                                content = m.ToolResult ?? string.Empty
                            }
                        }
                    });
                }
            }

            var tools = new List<object>();
            foreach (var t in request.Tools)
            {
                tools.Add(new
                {
                    name = t.Name,
                    description = t.Description,
                    input_schema = ParseInput(t.JsonSchema)
                });
            }

            var bodyDict = new Dictionary<string, object?>
            {
                ["model"] = _options.Model,
                ["max_tokens"] = request.MaxTokens <= 0 ? _options.MaxTokens : request.MaxTokens,
                ["system"] = request.SystemPrompt,
                ["messages"] = messages
            };
            if (tools.Count > 0)
            {
                bodyDict["tools"] = tools;
            }

            return bodyDict;
        }

        private static JsonElement ParseInput(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return JsonDocument.Parse("{}").RootElement.Clone();
            try
            {
                return JsonDocument.Parse(json).RootElement.Clone();
            }
            catch (JsonException)
            {
                return JsonDocument.Parse("{}").RootElement.Clone();
            }
        }

        private static LlmCompletionResponse ParseResponse(string json)
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var result = new LlmCompletionResponse();

            if (root.TryGetProperty("model", out var model))
                result.ModelName = model.GetString() ?? string.Empty;

            if (root.TryGetProperty("stop_reason", out var sr))
                result.StopReason = sr.GetString() ?? string.Empty;

            if (root.TryGetProperty("usage", out var usage))
            {
                if (usage.TryGetProperty("input_tokens", out var it))
                    result.InputTokens = it.GetInt32();
                if (usage.TryGetProperty("output_tokens", out var ot))
                    result.OutputTokens = ot.GetInt32();
            }

            var textBuilder = new StringBuilder();
            if (root.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array)
            {
                foreach (var block in content.EnumerateArray())
                {
                    if (!block.TryGetProperty("type", out var typeEl)) continue;
                    var type = typeEl.GetString();

                    if (type == "text" && block.TryGetProperty("text", out var txt))
                    {
                        textBuilder.Append(txt.GetString());
                    }
                    else if (type == "tool_use")
                    {
                        var call = new LlmToolCall
                        {
                            Id = block.TryGetProperty("id", out var id) ? (id.GetString() ?? string.Empty) : string.Empty,
                            Name = block.TryGetProperty("name", out var n) ? (n.GetString() ?? string.Empty) : string.Empty,
                            ArgumentsJson = block.TryGetProperty("input", out var input) ? input.GetRawText() : "{}"
                        };
                        result.ToolCalls.Add(call);
                    }
                }
            }

            result.TextContent = textBuilder.Length > 0 ? textBuilder.ToString() : null;
            return result;
        }
    }
}
