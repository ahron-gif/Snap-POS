namespace BackOffice.Api.Services;
public class TenantProvider : ITenantProvider
{
    private string? _connectionString;
    private int? _customerId;
    private string? _customerName;

    public string? GetTenantConnectionString() => _connectionString;
    public void SetTenantConnectionString(string connectionString) => _connectionString = connectionString;

    public int? GetCustomerId() => _customerId;
    public string? GetCustomerName() => _customerName;
    public void SetCustomerInfo(int customerId, string customerName)
    {
        _customerId = customerId;
        _customerName = customerName;
    }
}