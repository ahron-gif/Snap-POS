using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using BackOffice.Application.Interfaces.Services.Chat;
using BackOffice.Application.Services.Chat;
using BackOffice.Application.Services.Chat.Tools;
using BackOffice.Infrastructure.Services.Llm;
using BackOffice.Persistence.Repositories.Chat;
using BackOffice.Persistence.Services.Chat;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BackOffice.Api.Extensions
{
    public static class ChatbotServiceCollectionExtensions
    {
        public static IServiceCollection AddChatbotServices(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            services.Configure<ClaudeOptions>(configuration.GetSection(ClaudeOptions.SectionName));
            services.Configure<GeminiOptions>(configuration.GetSection(GeminiOptions.SectionName));
            services.Configure<GroqOptions>(configuration.GetSection(GroqOptions.SectionName));
            services.Configure<GrokOptions>(configuration.GetSection(GrokOptions.SectionName));
            services.Configure<ChatLimitsOptions>(configuration.GetSection("Chatbot:Limits"));

            var provider = (configuration["Chatbot:Provider"] ?? "Claude").Trim();

            if (string.Equals(provider, "Mock", System.StringComparison.OrdinalIgnoreCase))
            {
                services.AddScoped<ILlmClient, MockLlmClient>();
            }
            else if (string.Equals(provider, "Gemini", System.StringComparison.OrdinalIgnoreCase))
            {
                services.AddHttpClient<ILlmClient, GeminiLlmClient>();
            }
            else if (string.Equals(provider, "Groq", System.StringComparison.OrdinalIgnoreCase))
            {
                services.AddHttpClient<ILlmClient, GroqLlmClient>();
            }
            else if (string.Equals(provider, "Grok", System.StringComparison.OrdinalIgnoreCase))
            {
                services.AddHttpClient<ILlmClient, GrokLlmClient>();
            }
            else
            {
                services.AddHttpClient<ILlmClient, ClaudeLlmClient>();
            }

            services.AddScoped<IChatHistoryRepository, ChatHistoryRepository>();
            services.AddScoped<IChatService, ChatService>();
            services.AddScoped<IChatActionDraftService, ChatActionDraftService>();
            services.AddScoped<IChatbotSettingsService, ChatbotSettingsService>();
            services.AddScoped<IPromptBuilder, PromptBuilder>();
            services.AddScoped<IToolExecutor, ToolExecutor>();
            services.AddScoped<IToolRegistry, ToolRegistry>();

            RegisterAllChatTools(services);

            return services;
        }

        private static void RegisterAllChatTools(IServiceCollection services)
        {
            var assemblies = new[]
            {
                typeof(ChatToolBase).Assembly,
                typeof(ChatbotSettingsService).Assembly
            };

            var toolTypes = assemblies
                .SelectMany(a => a.GetTypes())
                .Where(t => t.IsClass
                            && !t.IsAbstract
                            && typeof(IChatTool).IsAssignableFrom(t))
                .Distinct();

            foreach (var type in toolTypes)
            {
                services.AddScoped(typeof(IChatTool), type);
            }
        }
    }
}
