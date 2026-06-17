#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

/// <summary>
/// Mirror of <see cref="PendingUpgrade"/> but for mid-cycle add-on purchases
/// (extra devices/users beyond a Plan's FreeUnits). Created right before we
/// redirect the user to Stripe Checkout for the prorated payment; cleared
/// (CompletedAt set) when the matching webhook / status poll / reconcile pass
/// observes the session as paid and applies the change to the Stripe subscription.
///
/// <see cref="ItemsJson"/> stores the desired post-change quantities so the
/// apply step can rebuild the SubscriptionService.UpdateAsync call without
/// re-querying anything: <c>[{ "appId": 2, "quantity": 3 }, ...]</c>.
/// </summary>
public partial class PendingAddOn
{
    public int Id { get; set; }

    public string SessionId { get; set; } = null!;

    public int CustomerId { get; set; }

    /// <summary>JSON array of { AppId, Quantity } — total target quantity per app, not deltas.</summary>
    public string ItemsJson { get; set; } = null!;

    /// <summary>The proration total presented at Checkout, in major currency units (e.g. dollars).</summary>
    public decimal ProrationAmount { get; set; }

    public string? Notes { get; set; }

    public int? RequestedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    // --- Navigation properties ---

    public virtual Customer Customer { get; set; } = null!;
}
