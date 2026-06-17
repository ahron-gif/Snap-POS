namespace BackOffice.Application.DTOs.Chat
{
    public class ChatbotSettingsDto
    {
        public int CustomerId { get; set; }
        public bool IsEnabled { get; set; }
        public int DailyMessageCap { get; set; }
        public string ModelTier { get; set; } = "haiku";
        public long MonthlyTokenBudgetCents { get; set; }
    }
}
