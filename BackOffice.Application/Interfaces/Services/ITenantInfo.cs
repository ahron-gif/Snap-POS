namespace BackOffice.Application.Interfaces.Services
{
    /// <summary>
    /// Interface for getting current tenant/customer information
    /// </summary>
    public interface ITenantInfo
    {
        int? GetCustomerId();
        string? GetCustomerName();
    }
}
