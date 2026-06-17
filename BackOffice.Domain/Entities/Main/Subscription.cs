#nullable enable
using System;
using BackOffice.Domain.Enums;

namespace BackOffice.Domain.Entities.Main;

public partial class Subscription
{
    public int Id { get; set; }

    public int CustomerId { get; set; }

    public int PlanId { get; set; }

    public SubscriptionStatus Status { get; set; }

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public DateTime? GracePeriodEndsAt { get; set; }

    public DateTime? SuspendedAt { get; set; }

    public string? BillingEmail { get; set; }

    public int BillingCycleMonths { get; set; }

    // --- Stripe integration fields ---

    public bool IsPaid { get; set; }

    public DateTime? LastPaymentAt { get; set; }

    public string? StripeLastSessionId { get; set; }

    // --- Stripe Subscriptions (Phase 1) ---

    public string? StripeSubscriptionId { get; set; }

    public DateTime? CurrentPeriodStart { get; set; }

    public DateTime? CurrentPeriodEnd { get; set; }

    public bool CancelAtPeriodEnd { get; set; }

    public DateTime? CanceledAt { get; set; }

    public string? DefaultPaymentMethodId { get; set; }

    // Phase 6: Stripe pause_collection state for admin-driven pauses.
    // null = no pause; otherwise "keep_as_draft", "mark_uncollectible", or "void"
    public string? PauseCollectionBehavior { get; set; }

    // --- Navigation properties ---

    public virtual Customer Customer { get; set; } = null!;

    public virtual Plan Plan { get; set; } = null!;
}
