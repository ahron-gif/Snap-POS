using System.Text;
using BackOffice.Application.Integrations.RdtConnectorApi;
using BackOffice.Application.Integrations.RdtConnectorApi.Models;
using Newtonsoft.Json;
using Serilog;
using ILogger = Serilog.ILogger;

namespace BackOffice.Api.Integrations.RdtConnectorApi
{
    public class RdtConnectorApiClient : IRdtConnectorApiClient
    {
        private static readonly ILogger Logger = Log.ForContext<RdtConnectorApiClient>();

        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        private const int MaxRetries = 3;
        private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(1);

        public RdtConnectorApiClient(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _configuration = configuration;

            var baseUrl = _configuration["RdtConnectorApi:BaseUrl"];
            if (!string.IsNullOrEmpty(baseUrl))
            {
                _httpClient.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
            }

            var apiKey = _configuration["RdtConnectorApi:ApiKey"];
            if (!string.IsNullOrEmpty(apiKey))
            {
                _httpClient.DefaultRequestHeaders.Add("X-Internal-Api-Key", apiKey);
            }

            _httpClient.Timeout = TimeSpan.FromSeconds(10);
        }

        public async Task InvalidateCacheAsync(string token, params string[] cacheTypes)
        {
            if (string.IsNullOrWhiteSpace(token) || cacheTypes == null || cacheTypes.Length == 0)
            {
                Logger.Warning("InvalidateCacheAsync called with empty token or no cache types. Skipping.");
                return;
            }

            var request = new CacheInvalidateRequestDto
            {
                Token = token,
                Invalidate = cacheTypes.ToList()
            };

            var json = JsonConvert.SerializeObject(request);
            var logContext = $"Token={token}, Types=[{string.Join(", ", cacheTypes)}]";

            for (int attempt = 1; attempt <= MaxRetries; attempt++)
            {
                try
                {
                    using var content = new StringContent(json, Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync("internal/cache/invalidate", content);

                    if (response.IsSuccessStatusCode)
                    {
                        Logger.Information("Cache invalidation succeeded. {LogContext}", logContext);
                        return;
                    }

                    var responseBody = await response.Content.ReadAsStringAsync();
                    Logger.Warning(
                        "Cache invalidation failed (attempt {Attempt}/{MaxRetries}). Status={StatusCode}, Body={Body}, {LogContext}",
                        attempt, MaxRetries, (int)response.StatusCode, responseBody, logContext);
                }
                catch (Exception ex)
                {
                    Logger.Warning(ex,
                        "Cache invalidation error (attempt {Attempt}/{MaxRetries}). {LogContext}",
                        attempt, MaxRetries, logContext);
                }

                if (attempt < MaxRetries)
                {
                    await Task.Delay(RetryDelay * attempt);
                }
            }

            Logger.Error("Cache invalidation failed after {MaxRetries} attempts. {LogContext}", MaxRetries, logContext);
        }
    }
}
