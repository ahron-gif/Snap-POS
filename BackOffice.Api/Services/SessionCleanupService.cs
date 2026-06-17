using BackOffice.Application.Interfaces.Services.Main;

namespace BackOffice.Api.Services;

public class SessionCleanupService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SessionCleanupService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromHours(1);

    public SessionCleanupService(IServiceProvider serviceProvider, ILogger<SessionCleanupService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Session cleanup service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var sessionService = scope.ServiceProvider.GetRequiredService<ISessionService>();

                await sessionService.CleanupExpiredSessionsAsync();
                await sessionService.CleanupExpiredTemporaryTokensAsync();

                _logger.LogInformation("Session cleanup completed at {Time}", DateTime.UtcNow);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during session cleanup.");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }
}
