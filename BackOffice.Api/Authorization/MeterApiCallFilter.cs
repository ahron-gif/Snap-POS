using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Authorization
{
    /// <summary>
    /// Instantiated via <see cref="MeterApiCallAttribute"/>. Resolves the
    /// ApiDefinition once per (filter instance) — typed-filter instances are
    /// created per-action-execution, but EF query cost dominates the resolve
    /// step anyway, so no extra cache layer is needed at this scale.
    /// </summary>
    public class MeterApiCallFilter : IAsyncActionFilter
    {
        private readonly string _apiCode;
        private readonly int _callCount;
        private readonly IUsageTrackingService _usageTracking;
        private readonly MainDBContext _dbContext;
        private readonly ILogger<MeterApiCallFilter> _logger;

        public MeterApiCallFilter(
            string apiCode,
            int callCount,
            IUsageTrackingService usageTracking,
            MainDBContext dbContext,
            ILogger<MeterApiCallFilter> logger)
        {
            _apiCode = apiCode;
            _callCount = callCount;
            _usageTracking = usageTracking;
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var executed = await next();

            // Only record on success (2xx). Failed calls don't bill.
            var status = context.HttpContext.Response.StatusCode;
            if (status < 200 || status >= 300) return;
            if (executed.Exception != null) return;

            var customerIdClaim = context.HttpContext.User.FindFirst("CustomerId")?.Value;
            if (string.IsNullOrEmpty(customerIdClaim) || !int.TryParse(customerIdClaim, out var customerId) || customerId <= 0)
            {
                // No tenant context — likely super-admin or unauthenticated. Don't bill.
                return;
            }

            try
            {
                var apiDefId = await _dbContext.ApiDefinitions
                    .Where(a => a.Code == _apiCode && a.IsActive)
                    .Select(a => a.Id)
                    .FirstOrDefaultAsync();

                if (apiDefId == 0)
                {
                    _logger.LogWarning("MeterApiCall: ApiDefinition with Code '{ApiCode}' not found or inactive — skipping record.", _apiCode);
                    return;
                }

                await _usageTracking.RecordApiCallAsync(new RecordApiCallDto
                {
                    CustomerId = customerId,
                    ApiDefinitionId = apiDefId,
                    CallCount = _callCount,
                });
            }
            catch (Exception ex)
            {
                // Never propagate — billing is best-effort, the user's request already succeeded.
                _logger.LogError(ex, "MeterApiCall: failed to record usage for code '{ApiCode}', customer {CustomerId}", _apiCode, customerId);
            }
        }
    }
}
