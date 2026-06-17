namespace BackOffice.Domain.Enums
{
    /// <summary>
    /// Plan tier classification.
    /// Stored as int in the database.
    /// </summary>
    public enum PlanTier
    {
        Starter = 0,
        Pro = 1,
        Business = 2,
        Enterprise = 3
    }
}
