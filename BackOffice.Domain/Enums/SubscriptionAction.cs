namespace BackOffice.Domain.Enums
{
    /// <summary>
    /// Actions recorded in the CustomerSubscription audit trail.
    /// Stored as int in the database.
    /// </summary>
    public enum SubscriptionAction
    {
        Created = 0,
        Upgraded = 1,
        Downgraded = 2,
        Renewed = 3,
        Cancelled = 4,
        Suspended = 5,
        Reactivated = 6
    }
}
