namespace BackOffice.Infrastructure.Services.Llm
{
    public class GroqOptions
    {
        public const string SectionName = "Chatbot:Groq";

        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "llama-3.3-70b-versatile";
        public int MaxTokens { get; set; } = 800;
        public string BaseUrl { get; set; } = "https://api.groq.com/openai";
        public int TimeoutSeconds { get; set; } = 45;
        public double Temperature { get; set; } = 0.2;
    }
}
