namespace BackOffice.Domain.Enums
{
    /// <summary>
    /// Direction & origin of a CustomerCreditTransactions row.
    /// Stored as int in the database.
    /// </summary>
    public enum CreditTransactionType
    {
        /// <summary>Tenant added funds via Stripe Checkout (positive amount).</summary>
        TopUp = 1,
        /// <summary>Automatic deduction by the CheckAndRecord stored proc when a metered API call was billed (negative amount).</summary>
        ApiDeduction = 2,
        /// <summary>Stripe refund of a prior TopUp (negative amount).</summary>
        Refund = 3,
        /// <summary>Superadmin manual adjustment ± (signed amount; description required).</summary>
        AdminAdjustment = 4
    }
}
