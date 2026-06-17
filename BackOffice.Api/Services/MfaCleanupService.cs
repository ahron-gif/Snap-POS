using BackOffice.Application.Interfaces.Services.Main;

namespace BackOffice.Api.Services;

/// <summary>
/// Background service that periodically cleans up expired MFA challenges, OTP codes,
/// and old attempt logs to keep the database tidy.
/// Runs every 30 minutes.
/// </summary>
public class MfaCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MfaCleanupService> _logger;
    private static readonly TimeSpan _interval = TimeSpan.FromMinutes(30);

    public MfaCleanupService(IServiceScopeFactory scopeFactory, ILogger<MfaCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MfaCleanupService started. Runs every {Interval} minutes.", _interval.TotalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_interval, stoppingToken);

                using var scope = _scopeFactory.CreateScope();
                var mfaService = scope.ServiceProvider.GetRequiredService<IMfaService>();
                await mfaService.CleanupExpiredAsync();
            }
            catch (TaskCanceledException)
            {
                // Expected on shutdown — no action needed
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MfaCleanupService encountered an error during cleanup.");
            }
        }

        _logger.LogInformation("MfaCleanupService stopped.");
    }
}
