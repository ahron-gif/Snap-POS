namespace BackOffice.PrintAgent.Updates;

public class UpdateService
{
    private readonly ILogger<UpdateService> _logger;

    public UpdateService(ILogger<UpdateService> logger)
    {
        _logger = logger;
    }

    public Task CheckForUpdatesAsync(CancellationToken cancellationToken)
    {
        _logger.LogDebug("Update check skipped: Velopack feed not configured (set Updates:FeedUrl in appsettings).");
        return Task.CompletedTask;
    }
}
