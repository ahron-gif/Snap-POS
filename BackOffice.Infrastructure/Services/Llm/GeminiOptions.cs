namespace BackOffice.Infrastructure.Services.Llm
{
    public class GeminiOptions
    {
        public const string SectionName = "Chatbot:Gemini";

        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "gemini-2.0-flash";
        public int MaxTokens { get; set; } = 800;
        public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com";
        public int TimeoutSeconds { get; set; } = 45;
    }
}
