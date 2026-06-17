#nullable enable
using System;
using BackOffice.Domain.Enums;

namespace BackOffice.Domain.Entities.Main;

public partial class SubscriptionHistory
{
    public int Id { get; set; }

    public int CustomerId { get; set; }

    public int PlanId { get; set; }

    public SubscriptionAction Action { get; set; }

    public int? PreviousPlanId { get; set; }

    public decimal MonthlyAmount { get; set; }

    public DateTime EffectiveDate { get; set; }

    public DateTime? EndDate { get; set; }

    public string? Notes { get; set; }

    public int? ChangedBy { get; set; }

    // Phase 6: who initiated this change — 'admin', 'tenant', 'system' (webhook).
    public string? ChangedByRole { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual Plan Plan { get; set; } = null!;

    public virtual Plan? PreviousPlan { get; set; }
}
