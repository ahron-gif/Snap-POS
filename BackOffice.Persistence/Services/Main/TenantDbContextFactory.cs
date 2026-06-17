using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Services.Main;

public class TenantDbContextFactory : ITenantDbContextFactory
{
    public DbContext CreateForCustomer(string serverName, string dbName, string dbUser, string dbPass)
    {
        var connectionString = $"Data Source={serverName};Initial Catalog={dbName};User ID={dbUser};Password={dbPass};Persist Security Info=True;Connect Timeout=30;TrustServerCertificate=True;";

        var optionsBuilder = new DbContextOptionsBuilder<TenantDBContext>();
        optionsBuilder.UseSqlServer(connectionString);

        return new TenantDBContext(optionsBuilder.Options);
    }
}
