using Azure.Core;
using BackOffice.Api.Services;
using BackOffice.Application.Extensions;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.Security;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;
using Task = System.Threading.Tasks.Task;

public class TenantConnectionMiddleware
{
    private readonly RequestDelegate _next;

    public TenantConnectionMiddleware(RequestDelegate next)
    {
        _next = next;
       
    }

    public async Task InvokeAsync(HttpContext context, IMemoryCache memoryCache, MainDBContext mainDbContext, ITenantProvider tenantProvider, IPasswordCipher passwordCipher)
    {
        var authorizationHeader = context.Request.Headers["Authorization"].ToString();
        var customerIdHeader = context.Request.Headers["CustomerId"].ToString();

        if (string.IsNullOrEmpty(customerIdHeader))
        {
            customerIdHeader = context.Request.Query["Customerid"].ToString();
        }

        if (string.IsNullOrEmpty(authorizationHeader) || !authorizationHeader.StartsWith("Bearer "))
        {
            await _next(context);
            return;
        }

        var token = authorizationHeader.Substring("Bearer ".Length).Trim();

        var customerIdClaim = context.User.Claims.FirstOrDefault(c => c.Type == "CustomerId")?.Value;
        var emailClaim = context.User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value;
        var userId = context.User.Claims.FirstOrDefault(c => c.Type == "UserId")?.Value;
        var customerId = 0;

        if (!string.IsNullOrEmpty(emailClaim) || !string.IsNullOrEmpty(userId))
        {
            if (!string.IsNullOrEmpty(customerIdHeader))
            {
                customerId = Convert.ToInt32(customerIdHeader);
            }
            else
            {
                if (!string.IsNullOrEmpty(customerIdClaim))
                {
                    int.TryParse(customerIdClaim, out customerId);
                }
            }

            if (customerId > 0)
            {
                string? customerName = null;
                if (!memoryCache.TryGetValue($"Customer_{customerId}", out string connectionString))
                {
                    var customer = mainDbContext.Customers
                    .FirstOrDefault(c => c.CustomerId == customerId);

                    if (customer != null)
                    {
                        // WEB-152: prefer the encrypted password; fall back to plaintext DBPass for legacy customers.
                        var dbPassword = customer.ResolveDBPassword(passwordCipher);
                        connectionString = $"Data Source={customer.ServerName};Initial Catalog={customer.DBName};User ID={customer.DBUser};Password={dbPassword};Persist Security Info=True;Connect Timeout=30;";
                        customerName = customer.CustomerName;

                        memoryCache.Set($"Customer_{customerId}", connectionString, TimeSpan.FromMinutes(30));
                        memoryCache.Set($"CustomerName_{customerId}", customerName ?? string.Empty, TimeSpan.FromMinutes(30));
                    }
                }
                else
                {
                    // Get customer name from cache
                    customerName = memoryCache.Get<string>($"CustomerName_{customerId}");
                }

                if (!string.IsNullOrEmpty(connectionString))
                {
                    tenantProvider.SetTenantConnectionString(connectionString);
                    tenantProvider.SetCustomerInfo(customerId, customerName ?? string.Empty);

                    var tenantDBContext = context.RequestServices.GetRequiredService<TenantDBContext>();
                    tenantDBContext.Database.GetDbConnection().ConnectionString = connectionString;
                }
            }
            else
            {
                var customer = mainDbContext.Customers
                        .OrderBy(c => c.CustomerId)
                        .FirstOrDefault();

                if (customer != null)
                {
                    // WEB-152: prefer the encrypted password; fall back to plaintext DBPass for legacy customers.
                    var dbPassword = customer.ResolveDBPassword(passwordCipher);
                    var connectionString = $"Data Source={customer.ServerName};Initial Catalog={customer.DBName};User ID={customer.DBUser};Password={dbPassword};Persist Security Info=True;Connect Timeout=30;";

                    memoryCache.Set($"Customer_{customer.CustomerId}", connectionString, TimeSpan.FromMinutes(30));
                    memoryCache.Set($"CustomerName_{customer.CustomerId}", customer.CustomerName ?? string.Empty, TimeSpan.FromMinutes(30));

                    tenantProvider.SetTenantConnectionString(connectionString);
                    tenantProvider.SetCustomerInfo(customer.CustomerId, customer.CustomerName ?? string.Empty);

                    var tenantDBContext = context.RequestServices.GetRequiredService<TenantDBContext>();
                    tenantDBContext.Database.GetDbConnection().ConnectionString = connectionString;
                }
            }

        }

        await _next(context); 
    }
}
