using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
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
    // xAI's API is OpenAI-compatible, so the wire format mirrors GroqLlmClient.
    // Kept as a separate client so the provider name in config and logs is unambiguous
    // (Groq ≠ Grok — different vendors, different hosts, different keys).
    public class GrokLlmClient : ILlmClient
    {
        private readonly HttpClient _http;
        private readonly GrokOptions _options;
        private readonly ILogger<GrokLlmClient> _logger;

        public GrokLlmClient(
            HttpClient http,
            IOptions<GrokOptions> options,
            ILogger<GrokLlmClient> logger)
        {
            _http = http;
            _options = options.Value;
            _logger = logger;

            if (string.IsNullOrWhiteSpace(_options.ApiKey))
            {
                throw new InvalidOperationException(
                    "Grok (xAI) API key is not configured. Set Chatbot__Grok__ApiKey via env var or user-secrets.");
            }

            // One-shot diagnostic so you can confirm which key got loaded without ever
            // logging the secret itself. Compare length (xAI keys are ~84 chars) and the
            // last 4 chars against what's in the xAI console.
            var trimmed = _options.ApiKey.Trim();
            if (trimmed.Length != _options.ApiKey.Length)
            {
                _logger.LogWarning("Grok API key had leading/trailing whitespace — trimming.");
                _options.ApiKey = trimmed;
            }
            _logger.LogInformation(
                "Grok client initialised. Model={Model} BaseUrl={BaseUrl} KeyLen={KeyLen} KeyTail=…{KeyTail}",
                _options.Model,
                _options.BaseUrl,
                _options.ApiKey.Length,
                _options.ApiKey.Length >= 4 ? _options.ApiKey[^4..] : "??");

            _http.BaseAddress = new Uri(_options.BaseUrl.TrimEnd('/') + "/");
            _http.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
            _http.DefaultRequestHeaders.Accept.Clear();
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        public async Task<LlmCompletionResponse> CompleteAsync(LlmCompletionRequest request, CancellationToken ct = default)
        {
            var body = BuildRequestBody(request);
            var json = JsonSerializer.Serialize(body);

            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var response = await _http.PostAsync("v1/chat/completions", content, ct);

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "Grok (xAI) API call failed. Status={Status} Body={Body}",
                    response.StatusCode, responseJson);
                throw new InvalidOperationException($"Grok API returned {(int)response.StatusCode}: {responseJson}");
            }

            return ParseResponse(responseJson);
        }

        private object BuildRequestBody(LlmCompletionRequest request)
        {
            var messages = new List<object>();

            if (!string.IsNullOrWhiteSpace(request.SystemPrompt))
            {
                messages.Add(new { role = "system", content = request.SystemPrompt });
            }

            foreach (var m in request.Messages)
            {
                if (m.Role == "user")
                {
                    messages.Add(new { role = "user", content = m.Content ?? string.Empty });
                }
                else if (m.Role == "assistant")
                {
                    var hasToolCalls = m.ToolCalls != null && m.ToolCalls.Count > 0;

                    if (hasToolCalls)
                    {
                        var toolCalls = new List<object>();
                        foreach (var tc in m.ToolCalls!)
                        {
                            toolCalls.Add(new
                            {
                                id = tc.Id,
                                type = "function",
                                function = new
                                {
                                    name = tc.Name,
                                    arguments = string.IsNullOrWhiteSpace(tc.ArgumentsJson) ? "{}" : tc.ArgumentsJson
                                }
                            });
                        }

                        messages.Add(new
                        {
                            role = "assistant",
                            content = m.Content,
                            tool_calls = toolCalls
                        });
                    }
                    else
                    {
                        messages.Add(new { role = "assistant", content = m.Content ?? string.Empty });
                    }
                }
                else if (m.Role == "tool")
                {
                    messages.Add(new
                    {
                        role = "tool",
                        tool_call_id = m.ToolCallId ?? string.Empty,
                        content = m.ToolResult ?? string.Empty
                    });
                }
            }

            var tools = new List<object>();
            foreach (var t in request.Tools)
            {
                tools.Add(new
                {
                    type = "function",
                    function = new
                    {
                        name = t.Name,
                        description = t.Description,
                        parameters = ParseJsonElement(t.JsonSchema)
                    }
                });
            }

            var bodyDict = new Dictionary<string, object?>
            {
                ["model"] = _options.Model,
                ["messages"] = messages,
                ["max_tokens"] = request.MaxTokens <= 0 ? _options.MaxTokens : request.MaxTokens,
                ["temperature"] = _options.Temperature
            };

            if (tools.Count > 0)
            {
                bodyDict["tools"] = tools;
                bodyDict["tool_choice"] = "auto";
            }

            return bodyDict;
        }

        private static JsonElement ParseJsonElement(string json)
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

            if (root.TryGetProperty("usage", out var usage))
            {
                if (usage.TryGetProperty("prompt_tokens", out var it))
                    result.InputTokens = it.GetInt32();
                if (usage.TryGetProperty("completion_tokens", out var ot))
                    result.OutputTokens = ot.GetInt32();
            }

            if (!root.TryGetProperty("choices", out var choices) || choices.ValueKind != JsonValueKind.Array)
            {
                return result;
            }

            foreach (var choice in choices.EnumerateArray())
            {
                if (choice.TryGetProperty("finish_reason", out var fr))
                    result.StopReason = fr.GetString() ?? string.Empty;

                if (!choice.TryGetProperty("message", out var message))
                    continue;

                if (message.TryGetProperty("content", out var contentEl)
                    && contentEl.ValueKind == JsonValueKind.String)
                {
                    var text = contentEl.GetString();
                    if (!string.IsNullOrEmpty(text))
                    {
                        result.TextContent = text;
                    }
                }

                if (message.TryGetProperty("tool_calls", out var toolCallsEl)
                    && toolCallsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var tc in toolCallsEl.EnumerateArray())
                    {
                        var call = new LlmToolCall
                        {
                            Id = tc.TryGetProperty("id", out var id) ? (id.GetString() ?? string.Empty) : string.Empty
                        };

                        if (tc.TryGetProperty("function", out var fn))
                        {
                            call.Name = fn.TryGetProperty("name", out var n) ? (n.GetString() ?? string.Empty) : string.Empty;
                            call.ArgumentsJson = fn.TryGetProperty("arguments", out var args)
                                ? (args.ValueKind == JsonValueKind.String ? (args.GetString() ?? "{}") : args.GetRawText())
                                : "{}";
                        }

                        result.ToolCalls.Add(call);
                    }
                }

                break;
            }

            return result;
        }
    }
}
