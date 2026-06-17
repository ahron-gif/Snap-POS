namespace BackOffice.Domain.Enums
{
    /// <summary>
    /// Invoice lifecycle status.
    /// Stored as int in the database.
    /// </summary>
    public enum InvoiceStatus
    {
        Draft = 0,
        Issued = 1,
        Paid = 2,
        PastDue = 3,
        Void = 4,
        Refunded = 5
    }
}
