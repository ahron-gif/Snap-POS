#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class CustomerAppLicense
{
    public int Id { get; set; }

    public int CustomerId { get; set; }

    public int AppId { get; set; }

    public string? DeviceLabel { get; set; }

    public DateTime ActivatedAt { get; set; }

    // Exclusive end-of-cycle date set when user requests removal.
    // Null = active and continues into future cycles.
    // Billing predicate: license is in cycle [Pstart, Pend) when
    //   ActivatedAt < Pend AND (BillingEndsAt IS NULL OR BillingEndsAt > Pstart)
    public DateTime? BillingEndsAt { get; set; }

    public DateTime? RemovalRequestedAt { get; set; }

    public int? CreatedBy { get; set; }

    public int? RemovedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public bool IsPlanBaseline { get; set; }

    public virtual Customer? Customer { get; set; }
}
