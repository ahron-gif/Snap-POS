#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main
{
    public partial class TenantChatbotSettings
    {
        public int Id { get; set; }

        public int CustomerId { get; set; }

        public bool IsEnabled { get; set; }

        public int DailyMessageCap { get; set; }

        public string ModelTier { get; set; } = null!;

        public long MonthlyTokenBudgetCents { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }
    }
}
