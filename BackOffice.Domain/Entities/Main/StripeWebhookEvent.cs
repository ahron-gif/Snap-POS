#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class StripeWebhookEvent
{
    public int Id { get; set; }

    public string EventId { get; set; } = null!;

    public string EventType { get; set; } = null!;

    public DateTime ReceivedAt { get; set; }

    public DateTime? ProcessedAt { get; set; }

    public string? ProcessingError { get; set; }
}
