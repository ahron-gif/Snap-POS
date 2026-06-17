#nullable enable
using System;
using System.Collections.Generic;
using BackOffice.Domain.Enums;

namespace BackOffice.Domain.Entities.Main;

public partial class Plan
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string Code { get; set; } = null!;

    /// <summary>
    /// DEPRECATED: kept for backward compat with existing RBAC code.
    /// All actual per-app limits come from PlanAppPricings.MaxUnits
    /// </summary>
    public int MaxUsers { get; set; }

    public BillingCycle BillingCycle { get; set; }

    public decimal Price { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    // --- New billing fields ---

    public string? Description { get; set; }

    public PlanTier? Tier { get; set; }

    public int SortOrder { get; set; }

    // --- Stripe Subscriptions linkage ---

    public string? StripeProductId { get; set; }

    public string? StripeMonthlyPriceId { get; set; }

    public string? StripeYearlyPriceId { get; set; }

    // --- Navigation properties ---

    public virtual ICollection<PlanModule> PlanModules { get; set; } = new List<PlanModule>();

    public virtual ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();

    public virtual ICollection<PlanAppPricing> PlanAppPricings { get; set; } = new List<PlanAppPricing>();

    public virtual ICollection<PlanApiPricing> PlanApiPricings { get; set; } = new List<PlanApiPricing>();

    public virtual ICollection<PlanFeature> PlanFeatures { get; set; } = new List<PlanFeature>();

    public virtual ICollection<SubscriptionHistory> SubscriptionHistories { get; set; } = new List<SubscriptionHistory>();
}
