namespace BackOffice.Domain.Enums
{
    /// <summary>
    /// Payment attempt outcome status.
    /// Stored as int in the database.
    /// </summary>
    public enum PaymentStatus
    {
        Pending = 0,
        Success = 1,
        Failed = 2
    }
}
