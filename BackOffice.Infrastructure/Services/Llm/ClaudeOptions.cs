namespace BackOffice.Infrastructure.Services.Llm
{
    public class ClaudeOptions
    {
        public const string SectionName = "Chatbot:Claude";

        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "claude-haiku-4-5-20251001";
        public int MaxTokens { get; set; } = 800;
        public string BaseUrl { get; set; } = "https://api.anthropic.com";
        public string AnthropicVersion { get; set; } = "2023-06-01";
        public int TimeoutSeconds { get; set; } = 45;
    }
}
