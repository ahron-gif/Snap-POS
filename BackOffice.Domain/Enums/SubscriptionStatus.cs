namespace BackOffice.Domain.Enums
{
    /// <summary>
    /// Customer subscription lifecycle status.
    /// Stored as int in the database.
    /// </summary>
    public enum SubscriptionStatus
    {
        Active = 0,
        Trial = 1,
        PastDue = 2,
        Suspended = 3,
        Cancelled = 4
    }
}
