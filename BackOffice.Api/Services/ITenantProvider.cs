namespace BackOffice.Api.Services;
public interface ITenantProvider
{
    string? GetTenantConnectionString();
    void SetTenantConnectionString(string connectionString);

    int? GetCustomerId();
    string? GetCustomerName();
    void SetCustomerInfo(int customerId, string customerName);
}