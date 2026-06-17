using BackOffice.Application.Interfaces.Services;

namespace BackOffice.Api.Services;

/// <summary>
/// Adapter that implements ITenantInfo using ITenantProvider
/// </summary>
public class TenantInfoAdapter : ITenantInfo
{
    private readonly ITenantProvider _tenantProvider;

    public TenantInfoAdapter(ITenantProvider tenantProvider)
    {
        _tenantProvider = tenantProvider;
    }

    public int? GetCustomerId() => _tenantProvider.GetCustomerId();
    public string? GetCustomerName() => _tenantProvider.GetCustomerName();
}
