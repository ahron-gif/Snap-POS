using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    public class CustomerAppLicenseService : ICustomerAppLicenseService
    {
        private readonly MainDBContext _dbContext;
        private readonly ILogger<CustomerAppLicenseService> _logger;

        public CustomerAppLicenseService(
            MainDBContext dbContext,
            ILogger<CustomerAppLicenseService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<ApiResponse<List<CustomerAppLicenseDto>>> GetLicensesAsync(int customerId, bool includeRemoved)
        {
            try
            {
                var query = _dbContext.CustomerAppLicenses
                    .Where(l => l.CustomerId == customerId);

                if (!includeRemoved)
                    query = query.Where(l => l.BillingEndsAt == null);

                var licenses = await query
                    .OrderBy(l => l.AppId)
                    .ThenByDescending(l => l.ActivatedAt)
                    .ToListAsync();

                var appIds = licenses.Select(l => l.AppId).Distinct().ToList();
                var appNames = appIds.Count > 0
                    ? await _dbContext.Apps
                        .Where(a => appIds.Contains(a.AppId))
                        .ToDictionaryAsync(a => a.AppId, a => a.AppName)
                    : new Dictionary<int, string>();

                var result = licenses.Select(l => MapToDto(l, appNames)).ToList();
                return ApiResponseFactory.Success(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching licenses for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<List<CustomerAppLicenseDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<LicenseSummaryDto>> GetSummaryAsync(int customerId)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<LicenseSummaryDto>("Customer not found.");

                var (cycleStart, cycleEnd) = GetCurrentCycle(customer.Subscription, DateTime.UtcNow);

                var inCycle = await _dbContext.CustomerAppLicenses
                    .Where(l => l.CustomerId == customerId
                        && l.ActivatedAt < cycleEnd
                        && (l.BillingEndsAt == null || l.BillingEndsAt > cycleStart))
                    .ToListAsync();

                var appIds = inCycle.Select(l => l.AppId).Distinct().ToList();
                var appNames = appIds.Count > 0
                    ? await _dbContext.Apps
                        .Where(a => appIds.Contains(a.AppId))
                        .ToDictionaryAsync(a => a.AppId, a => a.AppName)
                    : new Dictionary<int, string>();

                var byApp = inCycle
                    .GroupBy(l => l.AppId)
                    .Select(g => new LicenseSummaryByAppDto
                    {
                        AppId = g.Key,
                        AppName = appNames.GetValueOrDefault(g.Key),
                        ActiveCount = g.Count(l => l.BillingEndsAt == null),
                        PendingRemovalCount = g.Count(l => l.BillingEndsAt != null)
                    })
                    .OrderBy(x => x.AppId)
                    .ToList();

                return ApiResponseFactory.Success(new LicenseSummaryDto
                {
                    CustomerId = customerId,
                    CycleStart = cycleStart,
                    CycleEnd = cycleEnd,
                    ByApp = byApp
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching license summary for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<LicenseSummaryDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<CustomerAppLicenseDto>> AddLicenseAsync(int customerId, AddLicenseDto dto, int createdBy)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<CustomerAppLicenseDto>("Customer not found.");

                var app = await _dbContext.Apps.FirstOrDefaultAsync(a => a.AppId == dto.AppId);
                if (app == null)
                    return ApiResponseFactory.NotFound<CustomerAppLicenseDto>("App not found.");

                if (customer.Subscription == null)
                    return ApiResponseFactory.BadRequest<CustomerAppLicenseDto>("Customer has no active plan.");

                var planAppPricing = await _dbContext.PlanAppPricings
                    .FirstOrDefaultAsync(p => p.PlanId == customer.Subscription.PlanId && p.AppId == dto.AppId);

                if (planAppPricing == null || !planAppPricing.IsIncluded)
                    return ApiResponseFactory.BadRequest<CustomerAppLicenseDto>(
                        $"{app.AppName} is not included in the current plan.");

                var today = DateTime.UtcNow.Date;

                var license = new CustomerAppLicense
                {
                    CustomerId = customerId,
                    AppId = dto.AppId,
                    DeviceLabel = string.IsNullOrWhiteSpace(dto.DeviceLabel) ? null : dto.DeviceLabel.Trim(),
                    ActivatedAt = today,
                    BillingEndsAt = null,
                    RemovalRequestedAt = null,
                    CreatedBy = createdBy,
                    CreatedAt = DateTime.UtcNow,
                    IsPlanBaseline = false
                };

                _dbContext.CustomerAppLicenses.Add(license);
                await _dbContext.SaveChangesAsync();

                var appNames = new Dictionary<int, string> { { app.AppId, app.AppName } };
                return ApiResponseFactory.Success(MapToDto(license, appNames), "License added.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding license for customer {CustomerId}, app {AppId}", customerId, dto.AppId);
                return ApiResponseFactory.InternalError<CustomerAppLicenseDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> RequestRemovalAsync(int customerId, int licenseId, int removedBy)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<bool>("Customer not found.");

                var license = await _dbContext.CustomerAppLicenses
                    .FirstOrDefaultAsync(l => l.Id == licenseId && l.CustomerId == customerId);
                if (license == null)
                    return ApiResponseFactory.NotFound<bool>("License not found.");

                if (license.BillingEndsAt != null)
                    return ApiResponseFactory.BadRequest<bool>("License is already pending removal.");

                var (_, cycleEnd) = GetCurrentCycle(customer.Subscription, DateTime.UtcNow);

                license.BillingEndsAt = cycleEnd;
                license.RemovalRequestedAt = DateTime.UtcNow.Date;
                license.RemovedBy = removedBy;

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Removal scheduled. Device remains active until end of current cycle.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error requesting removal for license {LicenseId}, customer {CustomerId}", licenseId, customerId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        // Mirrors the cycle-walk in BillingService.CalculateEstimatedBillAsync.
        // Returns inclusive start, exclusive end.
        private static (DateTime start, DateTime end) GetCurrentCycle(Subscription? subscription, DateTime now)
        {
            var months = subscription?.BillingCycleMonths > 0 ? subscription.BillingCycleMonths : 1;
            var start = subscription?.StartDate ?? now.Date;
            var end = start.AddMonths(months);
            while (end <= now)
            {
                start = end;
                end = start.AddMonths(months);
            }
            return (start, end);
        }

        private static CustomerAppLicenseDto MapToDto(CustomerAppLicense license, IReadOnlyDictionary<int, string> appNames)
        {
            return new CustomerAppLicenseDto
            {
                Id = license.Id,
                CustomerId = license.CustomerId,
                AppId = license.AppId,
                AppName = appNames.TryGetValue(license.AppId, out var name) ? name : null,
                DeviceLabel = license.DeviceLabel,
                ActivatedAt = license.ActivatedAt,
                BillingEndsAt = license.BillingEndsAt,
                RemovalRequestedAt = license.RemovalRequestedAt,
                IsPlanBaseline = license.IsPlanBaseline,
                CreatedAt = license.CreatedAt
            };
        }

        public async Task<ApiResponse<bool>> SyncBaselineLicensesAsync(int customerId, int planId, int? changedBy)
        {
            try
            {
                var subscription = await _dbContext.Subscriptions
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);

                var planAppPricings = await _dbContext.PlanAppPricings
                    .Where(p => p.PlanId == planId && p.IsIncluded)
                    .ToListAsync();

                planAppPricings = planAppPricings
                    .GroupBy(p => p.AppId)
                    .Select(g => g.First())
                    .ToList();

                var allAppIds = planAppPricings.Select(p => p.AppId).ToList();

                var existingBaseline = await _dbContext.CustomerAppLicenses
                    .Where(l => l.CustomerId == customerId
                        && l.IsPlanBaseline
                        && l.BillingEndsAt == null)
                    .ToListAsync();

                var existingByApp = existingBaseline.GroupBy(l => l.AppId).ToDictionary(g => g.Key, g => g.ToList());

                var (_, cycleEnd) = GetCurrentCycle(subscription, DateTime.UtcNow);
                var today = DateTime.UtcNow.Date;
                var now = DateTime.UtcNow;

                foreach (var pricing in planAppPricings)
                {
                    var target = pricing.MaxUnits ?? 0;
                    var current = existingByApp.TryGetValue(pricing.AppId, out var list) ? list.Count : 0;

                    if (current < target)
                    {
                        var toAdd = target - current;
                        for (var i = 0; i < toAdd; i++)
                        {
                            _dbContext.CustomerAppLicenses.Add(new CustomerAppLicense
                            {
                                CustomerId = customerId,
                                AppId = pricing.AppId,
                                ActivatedAt = today,
                                BillingEndsAt = null,
                                RemovalRequestedAt = null,
                                CreatedBy = changedBy,
                                CreatedAt = now,
                                IsPlanBaseline = true,
                            });
                        }
                    }
                    else if (current > target)
                    {
                        var toRemove = current - target;
                        var rowsToEnd = list!
                            .OrderByDescending(l => l.ActivatedAt)
                            .ThenByDescending(l => l.Id)
                            .Take(toRemove)
                            .ToList();
                        foreach (var row in rowsToEnd)
                        {
                            row.BillingEndsAt = cycleEnd;
                            row.RemovalRequestedAt = today;
                            row.RemovedBy = changedBy;
                        }
                    }
                }

                foreach (var kvp in existingByApp)
                {
                    if (allAppIds.Contains(kvp.Key)) continue;
                    foreach (var row in kvp.Value)
                    {
                        row.BillingEndsAt = cycleEnd;
                        row.RemovalRequestedAt = today;
                        row.RemovedBy = changedBy;
                    }
                }

                await _dbContext.SaveChangesAsync();

                foreach (var pricing in planAppPricings)
                {
                    var target = pricing.MaxUnits ?? 0;
                    var actualCount = await _dbContext.CustomerAppLicenses
                        .CountAsync(l => l.CustomerId == customerId
                            && l.AppId == pricing.AppId
                            && l.IsPlanBaseline
                            && l.BillingEndsAt == null);

                    if (actualCount > target)
                    {
                        var excess = await _dbContext.CustomerAppLicenses
                            .Where(l => l.CustomerId == customerId
                                && l.AppId == pricing.AppId
                                && l.IsPlanBaseline
                                && l.BillingEndsAt == null)
                            .OrderByDescending(l => l.Id)
                            .Take(actualCount - target)
                            .ToListAsync();

                        _dbContext.CustomerAppLicenses.RemoveRange(excess);
                        _logger.LogWarning(
                            "SyncBaselineLicensesAsync: removed {ExcessCount} duplicate baseline rows for customer {CustomerId} app {AppId} (likely concurrent sync).",
                            excess.Count, customerId, pricing.AppId);
                    }
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Baseline licenses synced with plan.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing baseline licenses for customer {CustomerId} plan {PlanId}", customerId, planId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }
    }
}
