#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

/// <summary>
/// A line item attached to a subscription beyond the base plan: e.g. extra device
/// licenses, premium support, additional API quota. Each row maps to one Stripe
/// Subscription Item so proration/renewals are handled by Stripe.
/// </summary>
public partial class SubscriptionAddOn
{
    public int Id { get; set; }

    public int SubscriptionId { get; set; }

    public string FeatureCode { get; set; } = null!;

    public string FeatureName { get; set; } = null!;

    public int Quantity { get; set; }

    public string? StripeSubscriptionItemId { get; set; }

    public string? StripePriceId { get; set; }

    public decimal UnitAmount { get; set; }

    public DateTime AddedAt { get; set; }

    public DateTime? RemovedAt { get; set; }

    // --- Navigation properties ---

    public virtual Subscription Subscription { get; set; } = null!;
}
