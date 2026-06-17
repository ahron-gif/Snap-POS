namespace BackOffice.Infrastructure.Services.Llm
{
    public class GrokOptions
    {
        public const string SectionName = "Chatbot:Grok";

        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "grok-2-latest";
        public int MaxTokens { get; set; } = 800;
        public string BaseUrl { get; set; } = "https://api.x.ai";
        public int TimeoutSeconds { get; set; } = 45;
        public double Temperature { get; set; } = 0.2;
    }
}
