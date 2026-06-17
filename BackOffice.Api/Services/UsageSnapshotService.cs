using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Services;

/// <summary>
/// Hourly background job that snapshots current device/user counts
/// from CustomerApps into UsageRecords for billing calculations.
/// </summary>
public class UsageSnapshotService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<UsageSnapshotService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromHours(1);

    public UsageSnapshotService(IServiceProvider serviceProvider, ILogger<UsageSnapshotService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Usage snapshot service started.");

        // Initial delay
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TakeUsageSnapshotsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during usage snapshot.");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task TakeUsageSnapshotsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<MainDBContext>();
        var today = DateTime.UtcNow.Date;

        // Get all active customer apps with app names via join
        var customerApps = await (from ca in dbContext.CustomerApps
                                  join a in dbContext.Apps on ca.AppId equals a.AppId
                                  where ca.IsEnabled
                                  select new { ca.Id, ca.CustomerId, ca.AppId, ca.DevicesLimit, AppName = a.AppName })
                                  .ToListAsync();

        foreach (var ca in customerApps)
        {
            try
            {
                var metricType = ca.AppName ?? "Unknown";

                // Check if we already have a snapshot for today
                var existing = await dbContext.UsageRecords
                    .FirstOrDefaultAsync(u =>
                        u.CustomerId == ca.CustomerId
                        && u.AppId == ca.AppId
                        && u.MetricType == metricType
                        && u.RecordedDate == today);

                if (existing != null)
                {
                    // Update existing snapshot with latest count
                    existing.Count = ca.DevicesLimit;
                    existing.RecordedAt = DateTime.UtcNow;
                }
                else
                {
                    // Create new daily snapshot
                    dbContext.UsageRecords.Add(new Domain.Entities.Main.UsageRecord
                    {
                        CustomerId = ca.CustomerId,
                        AppId = ca.AppId,
                        MetricType = metricType,
                        Count = ca.DevicesLimit,
                        RecordedDate = today,
                        RecordedAt = DateTime.UtcNow
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error snapshotting usage for CustomerApp {Id}", ca.Id);
            }
        }

        // Also snapshot device counts from CustomerDevices table
        var deviceCounts = await dbContext.CustomerDevices
            .GroupBy(d => new { d.CustomerId, d.AppId })
            .Select(g => new { g.Key.CustomerId, g.Key.AppId, Count = g.Count() })
            .ToListAsync();

        foreach (var dc in deviceCounts)
        {
            try
            {
                var metricType = "active_devices";

                var existing = await dbContext.UsageRecords
                    .FirstOrDefaultAsync(u =>
                        u.CustomerId == dc.CustomerId
                        && u.AppId == dc.AppId
                        && u.MetricType == metricType
                        && u.RecordedDate == today);

                if (existing != null)
                {
                    existing.Count = dc.Count;
                    existing.RecordedAt = DateTime.UtcNow;
                }
                else
                {
                    dbContext.UsageRecords.Add(new Domain.Entities.Main.UsageRecord
                    {
                        CustomerId = dc.CustomerId,
                        AppId = dc.AppId,
                        MetricType = metricType,
                        Count = dc.Count,
                        RecordedDate = today,
                        RecordedAt = DateTime.UtcNow
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error snapshotting device counts for Customer {CustomerId}", dc.CustomerId);
            }
        }

        await dbContext.SaveChangesAsync();
        _logger.LogInformation("Usage snapshots completed at {Time}", DateTime.UtcNow);
    }
}
