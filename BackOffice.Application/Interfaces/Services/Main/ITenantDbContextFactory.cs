using Microsoft.EntityFrameworkCore;

namespace BackOffice.Application.Interfaces.Services.Main;

public interface ITenantDbContextFactory
{
    DbContext CreateForCustomer(string serverName, string dbName, string dbUser, string dbPass);
}
