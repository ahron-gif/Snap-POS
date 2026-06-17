#nullable enable
using System;
using BackOffice.Domain.Enums;

namespace BackOffice.Domain.Entities.Main;

public partial class PaymentAttempt
{
    public int Id { get; set; }

    public int InvoiceId { get; set; }

    public int CustomerId { get; set; }

    public DateTime AttemptedAt { get; set; }

    public PaymentStatus Status { get; set; }

    public string? FailureReason { get; set; }

    public string? PaymentProvider { get; set; }

    public string? ProviderTransactionId { get; set; }

    public decimal Amount { get; set; }

    public int AttemptNumber { get; set; }

    public virtual Invoice Invoice { get; set; } = null!;

    public virtual Customer Customer { get; set; } = null!;
}
