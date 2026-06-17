#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class PlanAppPricing
{
    public int Id { get; set; }

    public int PlanId { get; set; }

    public int AppId { get; set; }

    /// <summary>
    /// "per_user" | "per_device" | "flat"
    /// </summary>
    public string PricingModel { get; set; } = null!;

    public decimal PricePerUnit { get; set; }

    public int FreeUnits { get; set; }

    /// <summary>
    /// Max allowed per app (NULL = unlimited). This is the ONLY place limits are defined.
    /// </summary>
    public int? MaxUnits { get; set; }

    public bool IsIncluded { get; set; }

    /// <summary>
    /// Stripe Price id for the recurring overage line item. Created lazily by
    /// <c>StripeCatalogService.SyncPlanAsync</c> when <see cref="PricingModel"/>
    /// is non-flat and <see cref="PricePerUnit"/> &gt; 0. Used by add-on flows
    /// to charge the customer per extra device/user beyond <see cref="FreeUnits"/>.
    /// </summary>
    public string? StripeOveragePriceId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Plan Plan { get; set; } = null!;

    public virtual App App { get; set; } = null!;
}
