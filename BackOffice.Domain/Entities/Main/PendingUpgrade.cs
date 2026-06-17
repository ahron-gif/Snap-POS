#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class PendingUpgrade
{
    public int Id { get; set; }

    public string SessionId { get; set; } = null!;

    public int CustomerId { get; set; }

    public int NewPlanId { get; set; }

    public DateTime? EffectiveDate { get; set; }

    public string? Notes { get; set; }

    public int? RequestedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    // --- Navigation properties ---

    public virtual Customer Customer { get; set; } = null!;

    public virtual Plan NewPlan { get; set; } = null!;
}
