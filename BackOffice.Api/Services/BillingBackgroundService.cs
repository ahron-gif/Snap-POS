using BackOffice.Application.Configuration;
using BackOffice.Domain.Enums;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Services;

/// <summary>
/// Daily background job that handles:
/// 1. Generating invoices for customers whose billing period has ended
/// 2. Checking grace periods and suspending overdue accounts
/// </summary>
public class BillingBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BillingBackgroundService> _logger;
    private readonly Guid _currentEnvironmentId;
    private readonly TimeSpan _interval = TimeSpan.FromHours(24);

    public BillingBackgroundService(IServiceProvider serviceProvider, ILogger<BillingBackgroundService> logger, EnvironmentSettings environmentSettings)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _currentEnvironmentId = environmentSettings.CurrentEnvironmentId;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Billing background service started.");

        // Initial delay to let the app fully start
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBillingCycleAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during billing cycle processing.");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task ProcessBillingCycleAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<MainDBContext>();
        var today = DateTime.UtcNow.Date;

        // --- STEP 1: Find customers whose billing period has ended ---
        var dueCustomers = await dbContext.Customers
            .Include(c => c.Subscription)
            .Where(c => c.IsActive && (_currentEnvironmentId == Guid.Empty || c.EnvironmentId == _currentEnvironmentId)
                      && c.Subscription != null
                      && c.Subscription.EndDate != null
                      && c.Subscription.EndDate.Value <= today
                      && c.Subscription.Status == SubscriptionStatus.Active
                      && c.Subscription.PlanId != null)
            .ToListAsync();

        _logger.LogInformation("Found {Count} customers due for billing.", dueCustomers.Count);

        foreach (var customer in dueCustomers)
        {
            try
            {
                // For now, just advance the billing period.
                // Actual invoice generation + payment will be handled when Stripe/QuickBooks is integrated.
                var billingMonths = customer.Subscription!.BillingCycleMonths;
                customer.Subscription.StartDate = customer.Subscription.EndDate;
                customer.Subscription.EndDate = customer.Subscription.EndDate!.Value.AddMonths(billingMonths);

                _logger.LogInformation(
                    "Advanced billing period for customer {CustomerId} to {Start} - {End}",
                    customer.CustomerId, customer.Subscription.StartDate, customer.Subscription.EndDate);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing billing for customer {CustomerId}", customer.CustomerId);
            }
        }

        // --- STEP 2: Check grace periods and suspend overdue accounts ---
        var overdueCustomers = await dbContext.Customers
            .Include(c => c.Subscription)
            .Where(c => c.IsActive && (_currentEnvironmentId == Guid.Empty || c.EnvironmentId == _currentEnvironmentId)
                      && c.Subscription != null
                      && c.Subscription.GracePeriodEndsAt != null
                      && c.Subscription.GracePeriodEndsAt.Value <= today
                      && c.Subscription.Status == SubscriptionStatus.PastDue)
            .ToListAsync();

        _logger.LogInformation("Found {Count} customers past grace period.", overdueCustomers.Count);

        foreach (var customer in overdueCustomers)
        {
            try
            {
                customer.Subscription!.Status = SubscriptionStatus.Suspended;
                customer.Subscription.SuspendedAt = DateTime.UtcNow;

                // Create audit record
                dbContext.SubscriptionHistories.Add(new Domain.Entities.Main.SubscriptionHistory
                {
                    CustomerId = customer.CustomerId,
                    PlanId = customer.Subscription.PlanId,
                    Action = SubscriptionAction.Suspended,
                    MonthlyAmount = 0,
                    EffectiveDate = DateTime.UtcNow,
                    Notes = "Auto-suspended: grace period expired",
                    CreatedAt = DateTime.UtcNow
                });

                _logger.LogWarning("Customer {CustomerId} suspended due to expired grace period.", customer.CustomerId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error suspending customer {CustomerId}", customer.CustomerId);
            }
        }

        await dbContext.SaveChangesAsync();
        _logger.LogInformation("Billing cycle processing completed at {Time}", DateTime.UtcNow);
    }
}
