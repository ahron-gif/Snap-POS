using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Application.DTOs.Chat;
using BackOffice.Application.DTOs.Chat.Llm;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant.Chat;
using BackOffice.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BackOffice.Application.Services.Chat
{
    public class ChatLimitsOptions
    {
        public int DefaultDailyMessageCap { get; set; } = 500;
        public int MaxToolIterationsPerTurn { get; set; } = 3;
        public int HistoryWindowSize { get; set; } = 6;
    }

    public class ChatService : IChatService
    {
        private readonly ILlmClient _llmClient;
        private readonly IToolRegistry _toolRegistry;
        private readonly IToolExecutor _toolExecutor;
        private readonly IPromptBuilder _promptBuilder;
        private readonly IChatHistoryRepository _history;
        private readonly IChatbotSettingsService _settings;
        private readonly ILogger<ChatService> _logger;
        private readonly ChatLimitsOptions _limits;

        public ChatService(
            ILlmClient llmClient,
            IToolRegistry toolRegistry,
            IToolExecutor toolExecutor,
            IPromptBuilder promptBuilder,
            IChatHistoryRepository history,
            IChatbotSettingsService settings,
            ILogger<ChatService> logger,
            IOptions<ChatLimitsOptions> limits)
        {
            _llmClient = llmClient;
            _toolRegistry = toolRegistry;
            _toolExecutor = toolExecutor;
            _promptBuilder = promptBuilder;
            _history = history;
            _settings = settings;
            _logger = logger;
            _limits = limits.Value;
        }

        public async Task<ApiResponse<ChatMessageResponseDto>> SendMessageAsync(
            int userId,
            int customerId,
            ChatMessageRequestDto request,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(request.Content))
            {
                return ApiResponseFactory.BadRequest<ChatMessageResponseDto>("Message content is required.");
            }

            var tenantSettings = await _settings.GetForTenantAsync(customerId, ct);
            if (!tenantSettings.IsEnabled)
            {
                return ApiResponseFactory.Forbidden<ChatMessageResponseDto>("Chatbot is disabled for this tenant.");
            }

            var withinCap = await _settings.IsWithinDailyCapAsync(customerId, ct);
            if (!withinCap)
            {
                return ApiResponseFactory.Forbidden<ChatMessageResponseDto>("Daily chatbot usage limit reached.");
            }

            var convoGuid = request.ConversationGuid ?? Guid.NewGuid();
            var title = TruncateTitle(request.Content);
            var conversation = await _history.GetOrCreateConversationAsync(convoGuid, userId, title, ct);

            await _history.AddMessageAsync(new ChatMessage
            {
                ConversationId = conversation.Id,
                Role = ChatRole.User,
                Content = request.Content,
                CreatedAt = DateTime.UtcNow
            }, ct);

            var recent = await _history.GetRecentMessagesAsync(conversation.Id, _limits.HistoryWindowSize * 2, ct);
            var llmMessages = BuildLlmMessages(recent);

            var availableTools = await _toolRegistry.GetAvailableForUserAsync(userId, customerId, ct);
            var toolSchemas = _promptBuilder.BuildToolSchemas(availableTools);

            var systemPrompt = _promptBuilder.BuildSystemPrompt(userId, customerId, null, request.Context);
            var toolsInvoked = new List<ChatToolInvocationDto>();
            var pendingDrafts = new List<ChatActionDraftDto>();
            var visualizations = new List<ChatVisualizationDto>();
            var links = new List<ChatEntityLinkDto>();
            int totalInputTokens = 0;
            int totalOutputTokens = 0;
            string? modelName = null;
            string? finalText = null;

            var iterations = 0;
            while (iterations < _limits.MaxToolIterationsPerTurn)
            {
                iterations++;

                var llmReq = new LlmCompletionRequest
                {
                    SystemPrompt = systemPrompt,
                    Messages = llmMessages,
                    Tools = toolSchemas,
                    MaxTokens = 800,
                    EnablePromptCaching = true
                };

                var response = await _llmClient.CompleteAsync(llmReq, ct);
                totalInputTokens += response.InputTokens;
                totalOutputTokens += response.OutputTokens;
                modelName = response.ModelName;

                if (response.ToolCalls == null || response.ToolCalls.Count == 0)
                {
                    finalText = response.TextContent ?? string.Empty;
                    break;
                }

                llmMessages.Add(new LlmMessage
                {
                    Role = "assistant",
                    Content = response.TextContent,
                    ToolCalls = response.ToolCalls
                });

                foreach (var call in response.ToolCalls)
                {
                    var execCtx = new ChatToolContext
                    {
                        UserId = userId,
                        CustomerId = customerId,
                        ConversationId = conversation.Id
                    };
                    var toolResult = await _toolExecutor.ExecuteAsync(call.Name, call.ArgumentsJson, execCtx, ct);

                    toolsInvoked.Add(new ChatToolInvocationDto
                    {
                        ToolName = call.Name,
                        ArgumentsJson = call.ArgumentsJson,
                        ResultSummary = toolResult.IsSuccess ? "ok" : (toolResult.Error ?? "error")
                    });

                    if (toolResult.Visualization != null)
                    {
                        visualizations.Add(toolResult.Visualization);
                    }

                    if (toolResult.Links != null && toolResult.Links.Count > 0)
                    {
                        foreach (var link in toolResult.Links)
                        {
                            if (!links.Any(l => l.EntityType == link.EntityType && l.EntityId == link.EntityId))
                            {
                                links.Add(link);
                            }
                        }
                    }

                    await _history.AddMessageAsync(new ChatMessage
                    {
                        ConversationId = conversation.Id,
                        Role = ChatRole.Tool,
                        Content = toolResult.ResultJson,
                        ToolName = call.Name,
                        ToolCallId = call.Id,
                        ToolArgumentsJson = call.ArgumentsJson,
                        ToolResultJson = toolResult.ResultJson,
                        CreatedAt = DateTime.UtcNow
                    }, ct);

                    llmMessages.Add(new LlmMessage
                    {
                        Role = "tool",
                        ToolCallId = call.Id,
                        ToolResult = toolResult.ResultJson
                    });
                }
            }

            if (finalText == null)
            {
                finalText = "I could not complete your request within the allowed number of tool calls. Please rephrase or simplify.";
            }

            var (cleanedReply, followUps) = ExtractFollowUps(finalText);

            if (string.IsNullOrWhiteSpace(cleanedReply))
            {
                cleanedReply = visualizations.Count > 0
                    ? "Here's what I found — see the chart below."
                    : (toolsInvoked.Count > 0
                        ? "I checked but there's no data to report for that request."
                        : "I don't have a tool that can answer that yet.");
            }

            string? visualizationsJson = visualizations.Count > 0
                ? JsonSerializer.Serialize(visualizations)
                : null;

            string? linksJson = links.Count > 0
                ? JsonSerializer.Serialize(links)
                : null;

            string? followUpsJson = followUps.Count > 0
                ? JsonSerializer.Serialize(followUps)
                : null;

            await _history.AddMessageAsync(new ChatMessage
            {
                ConversationId = conversation.Id,
                Role = ChatRole.Assistant,
                Content = cleanedReply,
                InputTokens = totalInputTokens,
                OutputTokens = totalOutputTokens,
                ModelName = modelName,
                VisualizationsJson = visualizationsJson,
                LinksJson = linksJson,
                SuggestedFollowUpsJson = followUpsJson,
                CreatedAt = DateTime.UtcNow
            }, ct);

            await _history.UpdateConversationStatsAsync(conversation.Id, totalInputTokens, totalOutputTokens, ct);

            var dto = new ChatMessageResponseDto
            {
                ConversationGuid = conversation.ConversationGuid,
                AssistantReply = cleanedReply,
                ToolsInvoked = toolsInvoked,
                PendingDrafts = pendingDrafts,
                Visualizations = visualizations,
                Links = links,
                SuggestedFollowUps = followUps,
                InputTokens = totalInputTokens,
                OutputTokens = totalOutputTokens,
                ModelName = modelName
            };

            return ApiResponseFactory.Success(dto);
        }

        public async Task<ApiResponse<ChatConversationDto>> GetConversationAsync(
            int userId,
            Guid conversationGuid,
            CancellationToken ct = default)
        {
            var convo = await _history.GetByGuidAsync(conversationGuid, userId, ct);
            if (convo == null)
            {
                return ApiResponseFactory.NotFound<ChatConversationDto>("Conversation not found.");
            }

            var messages = await _history.GetRecentMessagesAsync(convo.Id, 200, ct);
            var dto = new ChatConversationDto
            {
                ConversationGuid = convo.ConversationGuid,
                Title = convo.Title,
                Messages = messages
                    .Where(m => m.Role != ChatRole.Tool)
                    .OrderBy(m => m.CreatedAt)
                    .Select(m => new ChatHistoryMessageDto
                    {
                        Role = m.Role,
                        Content = m.Content,
                        ToolName = m.ToolName,
                        CreatedAt = m.CreatedAt,
                        Visualizations = DeserializeList<ChatVisualizationDto>(m.VisualizationsJson),
                        Links = DeserializeList<ChatEntityLinkDto>(m.LinksJson),
                        SuggestedFollowUps = DeserializeList<string>(m.SuggestedFollowUpsJson)
                    })
                    .ToList()
            };
            return ApiResponseFactory.Success(dto);
        }

        public async Task<ApiResponse<List<ChatConversationSummaryDto>>> ListConversationsAsync(
            int userId,
            CancellationToken ct = default)
        {
            var convos = await _history.ListForUserAsync(userId, 50, ct);
            var dtos = convos.Select(c => new ChatConversationSummaryDto
            {
                ConversationGuid = c.ConversationGuid,
                Title = c.Title,
                TotalMessages = c.TotalMessages,
                UpdatedAt = c.UpdatedAt
            }).ToList();
            return ApiResponseFactory.Success(dtos);
        }

        public async Task<ApiResponse<bool>> DeleteConversationAsync(
            int userId,
            Guid conversationGuid,
            CancellationToken ct = default)
        {
            await _history.SoftDeleteAsync(conversationGuid, userId, ct);
            return ApiResponseFactory.Success(true);
        }

        private List<LlmMessage> BuildLlmMessages(List<ChatMessage> recent)
        {
            var ordered = recent.OrderBy(m => m.CreatedAt).ToList();
            var output = new List<LlmMessage>(ordered.Count);
            foreach (var m in ordered)
            {
                switch (m.Role)
                {
                    case ChatRole.User:
                        output.Add(new LlmMessage { Role = "user", Content = m.Content });
                        break;
                    case ChatRole.Assistant:
                        output.Add(new LlmMessage { Role = "assistant", Content = m.Content });
                        break;
                    case ChatRole.Tool:
                        output.Add(new LlmMessage
                        {
                            Role = "tool",
                            ToolCallId = m.ToolCallId,
                            ToolResult = m.ToolResultJson ?? m.Content
                        });
                        break;
                }
            }
            return output;
        }

        private static string TruncateTitle(string content)
        {
            var s = content.Trim();
            if (s.Length <= 80) return s;
            return s.Substring(0, 77) + "...";
        }

        private static readonly Regex FollowUpsRegex = new Regex(
            @"^\s*FOLLOWUPS\s*:\s*(\[.*?\])\s*$",
            RegexOptions.Multiline | RegexOptions.Compiled);

        private static (string cleanedText, List<string> followUps) ExtractFollowUps(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return (text, new List<string>());

            var match = FollowUpsRegex.Match(text);
            if (!match.Success) return (text.Trim(), new List<string>());

            var payload = match.Groups[1].Value;
            var followUps = new List<string>();
            try
            {
                var parsed = JsonSerializer.Deserialize<List<string>>(payload);
                if (parsed != null)
                {
                    followUps = parsed
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .Select(s => s.Trim())
                        .Take(3)
                        .ToList();
                }
            }
            catch (JsonException)
            {
                followUps = new List<string>();
            }

            var cleaned = FollowUpsRegex.Replace(text, string.Empty).TrimEnd();
            return (cleaned, followUps);
        }

        private static List<T>? DeserializeList<T>(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try { return JsonSerializer.Deserialize<List<T>>(json); }
            catch (JsonException) { return null; }
        }
    }
}
