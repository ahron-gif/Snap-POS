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
    public class GeminiLlmClient : ILlmClient
    {
        private readonly HttpClient _http;
        private readonly GeminiOptions _options;
        private readonly ILogger<GeminiLlmClient> _logger;

        public GeminiLlmClient(
            HttpClient http,
            IOptions<GeminiOptions> options,
            ILogger<GeminiLlmClient> logger)
        {
            _http = http;
            _options = options.Value;
            _logger = logger;

            _http.BaseAddress = new Uri(_options.BaseUrl.TrimEnd('/') + "/");
            _http.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
            _http.DefaultRequestHeaders.Accept.Clear();
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        public async Task<LlmCompletionResponse> CompleteAsync(LlmCompletionRequest request, CancellationToken ct = default)
        {
            var body = BuildRequestBody(request);
            var json = JsonSerializer.Serialize(body);

            var url = $"v1beta/models/{_options.Model}:generateContent?key={Uri.EscapeDataString(_options.ApiKey)}";

            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var response = await _http.PostAsync(url, content, ct);
            var responseJson = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "Gemini API call failed. Status={Status} Body={Body}",
                    response.StatusCode, responseJson);
                throw new InvalidOperationException($"Gemini API returned {(int)response.StatusCode}: {responseJson}");
            }

            return ParseResponse(responseJson);
        }

        private object BuildRequestBody(LlmCompletionRequest request)
        {
            var contents = new List<object>();

            foreach (var m in request.Messages)
            {
                if (m.Role == "user" && !string.IsNullOrEmpty(m.Content))
                {
                    contents.Add(new
                    {
                        role = "user",
                        parts = new object[] { new { text = m.Content } }
                    });
                }
                else if (m.Role == "assistant")
                {
                    var parts = new List<object>();
                    if (!string.IsNullOrEmpty(m.Content))
                        parts.Add(new { text = m.Content });

                    if (m.ToolCalls != null)
                    {
                        foreach (var tc in m.ToolCalls)
                        {
                            parts.Add(new
                            {
                                functionCall = new
                                {
                                    name = tc.Name,
                                    args = ParseJsonElement(tc.ArgumentsJson)
                                }
                            });
                        }
                    }

                    if (parts.Count > 0)
                        contents.Add(new { role = "model", parts });
                }
                else if (m.Role == "tool")
                {
                    contents.Add(new
                    {
                        role = "user",
                        parts = new object[]
                        {
                            new
                            {
                                functionResponse = new
                                {
                                    name = m.ToolCallId ?? string.Empty,
                                    response = new
                                    {
                                        content = m.ToolResult ?? string.Empty
                                    }
                                }
                            }
                        }
                    });
                }
            }

            var tools = new List<object>();
            if (request.Tools.Count > 0)
            {
                var functionDeclarations = new List<object>();
                foreach (var t in request.Tools)
                {
                    functionDeclarations.Add(new
                    {
                        name = t.Name,
                        description = t.Description,
                        parameters = ParseJsonElement(t.JsonSchema)
                    });
                }
                tools.Add(new { functionDeclarations });
            }

            var bodyDict = new Dictionary<string, object?>
            {
                ["contents"] = contents,
                ["generationConfig"] = new
                {
                    maxOutputTokens = request.MaxTokens <= 0 ? _options.MaxTokens : request.MaxTokens,
                    temperature = 0.2
                }
            };

            if (!string.IsNullOrWhiteSpace(request.SystemPrompt))
            {
                bodyDict["systemInstruction"] = new
                {
                    parts = new object[] { new { text = request.SystemPrompt } }
                };
            }

            if (tools.Count > 0)
            {
                bodyDict["tools"] = tools;
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

        private LlmCompletionResponse ParseResponse(string json)
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var result = new LlmCompletionResponse
            {
                ModelName = _options.Model
            };

            if (root.TryGetProperty("usageMetadata", out var usage))
            {
                if (usage.TryGetProperty("promptTokenCount", out var it))
                    result.InputTokens = it.GetInt32();
                if (usage.TryGetProperty("candidatesTokenCount", out var ot))
                    result.OutputTokens = ot.GetInt32();
            }

            if (!root.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array)
            {
                return result;
            }

            foreach (var candidate in candidates.EnumerateArray())
            {
                if (candidate.TryGetProperty("finishReason", out var fr))
                    result.StopReason = fr.GetString() ?? string.Empty;

                if (!candidate.TryGetProperty("content", out var contentEl))
                    continue;

                if (!contentEl.TryGetProperty("parts", out var parts) || parts.ValueKind != JsonValueKind.Array)
                    continue;

                var textBuilder = new StringBuilder();
                foreach (var part in parts.EnumerateArray())
                {
                    if (part.TryGetProperty("text", out var txt))
                    {
                        textBuilder.Append(txt.GetString());
                    }
                    else if (part.TryGetProperty("functionCall", out var fc))
                    {
                        var name = fc.TryGetProperty("name", out var n) ? (n.GetString() ?? string.Empty) : string.Empty;
                        var args = fc.TryGetProperty("args", out var a) ? a.GetRawText() : "{}";
                        result.ToolCalls.Add(new LlmToolCall
                        {
                            Id = name,
                            Name = name,
                            ArgumentsJson = args
                        });
                    }
                }

                if (textBuilder.Length > 0)
                {
                    result.TextContent = textBuilder.ToString();
                }

                break;
            }

            return result;
        }
    }
}
