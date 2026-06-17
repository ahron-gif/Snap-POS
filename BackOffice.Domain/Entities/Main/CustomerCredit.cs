#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

/// <summary>
/// Per-customer prepaid wallet used to pay for metered OpenAPI calls past the
/// free tier. One row per active customer. Balance is decremented atomically by
/// the CheckAndRecordApiCall stored proc; topped up by Stripe Checkout (one-off
/// payment) or by superadmin adjustment.
/// </summary>
/// <remarks>
/// There is intentionally NO <c>ICollection&lt;CustomerCreditTransaction&gt;</c>
/// navigation here. Transactions are FK'd to <see cref="Customer"/> directly
/// (matches the ledger's append-only audit semantics), not to this wallet row.
/// A collection nav would make EF Core convention infer a shadow
/// <c>CustomerCreditId</c> FK column on <c>CustomerCreditTransactions</c> that
/// doesn't exist in the schema — every INSERT then fails with
/// "Invalid column name 'CustomerCreditId'". Query the ledger via
/// <c>_db.CustomerCreditTransactions.Where(t =&gt; t.CustomerId == …)</c>.
/// </remarks>
public partial class CustomerCredit
{
    public int Id { get; set; }

    public int CustomerId { get; set; }

    /// <summary>Current available balance in <see cref="Currency"/>.</summary>
    public decimal Balance { get; set; }

    public string Currency { get; set; } = "USD";

    public DateTime? LastTopUpAt { get; set; }

    public decimal? LastTopUpAmount { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    /// <summary>EF Core optimistic-concurrency token; the stored proc uses UPDLOCK/HOLDLOCK so EF
    /// callers (top-up, adjustment) need their own race protection.</summary>
    public byte[]? RowVersion { get; set; }

    public virtual Customer Customer { get; set; } = null!;
}
