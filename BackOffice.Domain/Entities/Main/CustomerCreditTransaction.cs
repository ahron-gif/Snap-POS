#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

/// <summary>
/// Append-only ledger for every credit-balance movement. One row per top-up,
/// API-call deduction, refund, or admin adjustment. BalanceAfter is captured at
/// write time so a tenant can audit the running balance without summing every
/// row from t=0.
/// </summary>
public partial class CustomerCreditTransaction
{
    public long Id { get; set; }

    public int CustomerId { get; set; }

    /// <summary>See <see cref="BackOffice.Domain.Enums.CreditTransactionType"/>.</summary>
    public int Type { get; set; }

    /// <summary>Signed: positive for top-ups/refunds/upward adjustments, negative for deductions/downward adjustments.</summary>
    public decimal Amount { get; set; }

    /// <summary>Wallet balance immediately after this row was applied. Allows direct audit without summation.</summary>
    public decimal BalanceAfter { get; set; }

    // Optional context — populated only for ApiDeduction rows.
    public int? ApiDefinitionId { get; set; }
    public long? ApiUsageLogId { get; set; }
    public int? CallCount { get; set; }

    /// <summary>Stripe PaymentIntent id for TopUp rows; used as the idempotency key
    /// so a duplicate webhook delivery cannot credit the customer twice.</summary>
    public string? StripePaymentIntentId { get; set; }

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>WebAppUser.UserId of the operator who initiated the transaction,
    /// or <c>null</c> for system-driven rows (e.g. the API-deduction proc).</summary>
    public int? CreatedByUserId { get; set; }

    public virtual Customer Customer { get; set; } = null!;
    public virtual ApiDefinition? ApiDefinition { get; set; }
    public virtual ApiUsageLog? ApiUsageLog { get; set; }
}
