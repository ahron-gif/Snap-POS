using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    public class UsageTrackingService : IUsageTrackingService
    {
        private readonly MainDBContext _dbContext;
        private readonly ILogger<UsageTrackingService> _logger;

        public UsageTrackingService(
            MainDBContext dbContext,
            ILogger<UsageTrackingService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<ApiResponse<CustomerUsageDashboardDto>> GetCustomerUsageAsync(int customerId)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription)
                        .ThenInclude(s => s.Plan)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<CustomerUsageDashboardDto>("Customer not found.");

                if (customer.Subscription?.Plan == null)
                    return ApiResponseFactory.BadRequest<CustomerUsageDashboardDto>("Customer has no plan assigned.");

                var planId = customer.Subscription.PlanId;
                var today = DateTime.UtcNow.Date;
                var monthStart = new DateTime(today.Year, today.Month, 1);

                // --- Device / App usage ---
                var planAppPricings = await _dbContext.PlanAppPricings
                    .Where(p => p.PlanId == planId)
                    .ToListAsync();

                // Load app names separately (App nav is ignored in EF config)
                var papAppIds = planAppPricings.Select(p => p.AppId).Distinct().ToList();
                var appNameMap = papAppIds.Count > 0
                    ? await _dbContext.Apps.Where(a => papAppIds.Contains(a.AppId)).ToDictionaryAsync(a => a.AppId, a => a.AppName)
                    : new Dictionary<int, string>();

                var customerApps = await _dbContext.CustomerApps
                    .Where(ca => ca.CustomerId == customerId)
                    .ToListAsync();

                var latestUsageRecords = await _dbContext.UsageRecords
                    .Where(u => u.CustomerId == customerId && u.RecordedDate >= monthStart)
                    .ToListAsync();

                var deviceUsage = new List<UsageSnapshotDto>();
                foreach (var pap in planAppPricings)
                {
                    var ca = customerApps.FirstOrDefault(x => x.AppId == pap.AppId);
                    var limit = ca?.DeviceLimitOverride ?? pap.MaxUnits ?? 0;

                    var currentCount = latestUsageRecords
                        .Where(u => u.AppId == pap.AppId)
                        .OrderByDescending(u => u.RecordedDate)
                        .Select(u => u.Count)
                        .FirstOrDefault();

                    if (currentCount == 0 && ca != null)
                        currentCount = ca.DevicesLimit;

                    deviceUsage.Add(new UsageSnapshotDto
                    {
                        MetricType = pap.PricingModel,
                        AppId = pap.AppId,
                        AppName = appNameMap.GetValueOrDefault(pap.AppId, $"App {pap.AppId}"),
                        CurrentCount = currentCount,
                        Limit = limit,
                        PercentUsed = limit > 0 ? Math.Round((decimal)currentCount / limit * 100, 2) : 0
                    });
                }

                // --- API usage ---
                var planApiPricings = await _dbContext.PlanApiPricings
                    .Include(p => p.ApiDefinition)
                    .Where(p => p.PlanId == planId)
                    .ToListAsync();

                var customerApiOverrides = await _dbContext.CustomerApiOverrides
                    .Where(o => o.CustomerId == customerId)
                    .ToListAsync();

                var apiUsageLogs = await _dbContext.ApiUsageLogs
                    .Where(u => u.CustomerId == customerId && u.RecordedDate >= monthStart)
                    .ToListAsync();

                var apiUsage = new List<ApiUsageSnapshotDto>();
                foreach (var pap in planApiPricings)
                {
                    var overr = customerApiOverrides.FirstOrDefault(o => o.ApiDefinitionId == pap.ApiDefinitionId);
                    var rate = overr?.RateOverride ?? pap.RatePerCall;
                    var freeTier = overr?.FreeTierOverride ?? pap.FreeTierCalls;

                    var totalCalls = apiUsageLogs
                        .Where(l => l.ApiDefinitionId == pap.ApiDefinitionId)
                        .Sum(l => l.CallCount);

                    var billable = Math.Max(0, totalCalls - freeTier);

                    apiUsage.Add(new ApiUsageSnapshotDto
                    {
                        ApiDefinitionId = pap.ApiDefinitionId,
                        ApiName = pap.ApiDefinition?.Name ?? "",
                        TotalCalls = totalCalls,
                        FreeTier = freeTier,
                        BillableCalls = billable,
                        Rate = rate,
                        Cost = billable * rate
                    });
                }

                // --- Transaction usage from BillingConfigs ---
                var txCountStr = await _dbContext.BillingConfigs
                    .Where(c => c.ConfigKey == "TransactionCount_" + customerId)
                    .Select(c => c.ConfigValue)
                    .FirstOrDefaultAsync();
                var txFreeTierStr = await _dbContext.BillingConfigs
                    .Where(c => c.ConfigKey == "TransactionFreeTier")
                    .Select(c => c.ConfigValue)
                    .FirstOrDefaultAsync();
                var txRateStr = await _dbContext.BillingConfigs
                    .Where(c => c.ConfigKey == "TransactionRate")
                    .Select(c => c.ConfigValue)
                    .FirstOrDefaultAsync();

                int.TryParse(txCountStr, out var transactionCount);
                int.TryParse(txFreeTierStr, out var transactionFreeTier);
                decimal.TryParse(txRateStr, out var transactionRate);

                var transactionBillable = Math.Max(0, transactionCount - transactionFreeTier);

                var dashboard = new CustomerUsageDashboardDto
                {
                    CustomerId = customerId,
                    CustomerName = customer.CustomerName,
                    PlanName = customer.Subscription!.Plan!.Name,
                    DeviceUsage = deviceUsage,
                    ApiUsage = apiUsage,
                    TransactionCount = transactionCount,
                    TransactionFreeTier = transactionFreeTier,
                    TransactionBillable = transactionBillable,
                    TransactionRate = transactionRate,
                    TransactionCost = transactionBillable * transactionRate
                };

                return ApiResponseFactory.Success(dashboard);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching customer usage for {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CustomerUsageDashboardDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> RecordUsageAsync(RecordUsageDto dto)
        {
            try
            {
                var today = DateTime.UtcNow.Date;

                var existing = await _dbContext.UsageRecords
                    .FirstOrDefaultAsync(u =>
                        u.CustomerId == dto.CustomerId &&
                        u.AppId == dto.AppId &&
                        u.MetricType == dto.MetricType &&
                        u.RecordedDate == today);

                if (existing != null)
                {
                    existing.Count = dto.Count;
                    existing.RecordedAt = DateTime.UtcNow;
                }
                else
                {
                    _dbContext.UsageRecords.Add(new UsageRecord
                    {
                        CustomerId = dto.CustomerId,
                        AppId = dto.AppId,
                        MetricType = dto.MetricType,
                        Count = dto.Count,
                        RecordedDate = today,
                        RecordedAt = DateTime.UtcNow
                    });
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Usage recorded successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recording usage for customer {CustomerId}", dto.CustomerId);
                return ApiResponseFactory.InternalError<bool>($"Error recording usage: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> RecordApiCallAsync(RecordApiCallDto dto)
        {
            try
            {
                var today = DateTime.UtcNow.Date;

                // Determine billing period from customer subscription dates
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == dto.CustomerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<bool>("Customer not found.");

                var billingStart = customer.Subscription?.StartDate ?? new DateTime(today.Year, today.Month, 1);
                var billingEnd = customer.Subscription?.EndDate ?? billingStart.AddMonths(1).AddDays(-1);

                var existing = await _dbContext.ApiUsageLogs
                    .FirstOrDefaultAsync(u =>
                        u.CustomerId == dto.CustomerId &&
                        u.ApiDefinitionId == dto.ApiDefinitionId &&
                        u.RecordedDate == today);

                if (existing != null)
                {
                    existing.CallCount += dto.CallCount;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _dbContext.ApiUsageLogs.Add(new ApiUsageLog
                    {
                        CustomerId = dto.CustomerId,
                        ApiDefinitionId = dto.ApiDefinitionId,
                        CallCount = dto.CallCount,
                        RecordedDate = today,
                        BillingPeriodStart = billingStart,
                        BillingPeriodEnd = billingEnd,
                        CreatedAt = DateTime.UtcNow
                    });
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "API call recorded successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recording API call for customer {CustomerId}", dto.CustomerId);
                return ApiResponseFactory.InternalError<bool>($"Error recording API call: {ex.Message}");
            }
        }

        public async Task<ApiResponse<RegisterDeviceResultDto>> RegisterDeviceAsync(int customerId, RegisterDeviceDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.AdvancedUId))
                    return ApiResponseFactory.BadRequest<RegisterDeviceResultDto>("AdvancedUId (device fingerprint) is required.");

                var inactiveDays = await GetInactiveDaysThresholdAsync();
                var activeFrom = DateTime.UtcNow.AddDays(-inactiveDays);

                var existing = await _dbContext.CustomerDevices
                    .FirstOrDefaultAsync(d =>
                        d.CustomerId == customerId &&
                        d.AppId == dto.AppId &&
                        d.AdvancedUId == dto.AdvancedUId);

                if (existing != null)
                {
                    existing.LastLoginDate = DateTime.UtcNow;
                    if (!string.IsNullOrWhiteSpace(dto.DeviceName))
                        existing.DeviceName = dto.DeviceName;
                    existing.DateModified = DateTime.UtcNow;
                    await _dbContext.SaveChangesAsync();

                    var (used, total) = await CountSlotsAsync(customerId, dto.AppId, activeFrom);
                    return ApiResponseFactory.Success(new RegisterDeviceResultDto
                    {
                        Allowed = true,
                        DeviceId = existing.DeviceId,
                        LicenseId = existing.LicenseId,
                        IsNewDevice = false,
                        SlotsUsed = used,
                        SlotsTotal = total,
                    }, "Heartbeat recorded.");
                }

                var (slotsUsed, slotsTotal) = await CountSlotsAsync(customerId, dto.AppId, activeFrom);
                if (slotsUsed >= slotsTotal)
                {
                    return ApiResponseFactory.Success(new RegisterDeviceResultDto
                    {
                        Allowed = false,
                        Reason = slotsTotal == 0
                            ? "No license slots allocated for this app. Add a license in Licenses & Billing."
                            : $"License limit reached ({slotsUsed}/{slotsTotal} active). Add a license or remove an inactive device.",
                        IsNewDevice = false,
                        SlotsUsed = slotsUsed,
                        SlotsTotal = slotsTotal,
                    });
                }

                var claimed = await _dbContext.CustomerAppLicenses
                    .Where(l => l.CustomerId == customerId
                        && l.AppId == dto.AppId
                        && l.BillingEndsAt == null)
                    .OrderBy(l => l.ActivatedAt)
                    .ThenBy(l => l.Id)
                    .Where(l => !_dbContext.CustomerDevices.Any(d => d.LicenseId == l.Id))
                    .FirstOrDefaultAsync();

                var newDevice = new CustomerDevice
                {
                    CustomerId = customerId,
                    AppId = dto.AppId,
                    AdvancedUId = dto.AdvancedUId,
                    DeviceName = string.IsNullOrWhiteSpace(dto.DeviceName) ? null : dto.DeviceName.Trim(),
                    LastLoginDate = DateTime.UtcNow,
                    DateCreated = DateTime.UtcNow,
                    LicenseId = claimed?.Id,
                };

                _dbContext.CustomerDevices.Add(newDevice);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(new RegisterDeviceResultDto
                {
                    Allowed = true,
                    DeviceId = newDevice.DeviceId,
                    LicenseId = newDevice.LicenseId,
                    IsNewDevice = true,
                    SlotsUsed = slotsUsed + 1,
                    SlotsTotal = slotsTotal,
                }, "Device registered.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registering device for customer {CustomerId}, app {AppId}", customerId, dto.AppId);
                return ApiResponseFactory.InternalError<RegisterDeviceResultDto>($"Error registering device: {ex.Message}");
            }
        }

        public async Task<ApiResponse<DeviceLimitDto>> CheckDeviceLimitAsync(int customerId, int appId)
        {
            try
            {
                var inactiveDays = await GetInactiveDaysThresholdAsync();
                var activeFrom = DateTime.UtcNow.AddDays(-inactiveDays);
                var (used, total) = await CountSlotsAsync(customerId, appId, activeFrom);

                return ApiResponseFactory.Success(new DeviceLimitDto
                {
                    AppId = appId,
                    SlotsUsed = used,
                    SlotsTotal = total,
                    CanRegisterNew = used < total,
                    InactiveDays = inactiveDays,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking device limit for customer {CustomerId}, app {AppId}", customerId, appId);
                return ApiResponseFactory.InternalError<DeviceLimitDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<List<DeviceLimitDto>>> GetAllDeviceLimitsAsync(int customerId)
        {
            try
            {
                var inactiveDays = await GetInactiveDaysThresholdAsync();
                var activeFrom = DateTime.UtcNow.AddDays(-inactiveDays);

                // App scope: any app this customer has licenses for, OR any app on their plan
                var licenseAppIds = await _dbContext.CustomerAppLicenses
                    .Where(l => l.CustomerId == customerId && l.BillingEndsAt == null)
                    .Select(l => l.AppId)
                    .Distinct()
                    .ToListAsync();

                var planAppIds = await (
                    from sub in _dbContext.Subscriptions
                    join pap in _dbContext.PlanAppPricings on sub.PlanId equals pap.PlanId
                    where sub.CustomerId == customerId && pap.IsIncluded
                    select pap.AppId
                ).Distinct().ToListAsync();

                var appIds = licenseAppIds.Union(planAppIds).ToList();
                if (appIds.Count == 0)
                    return ApiResponseFactory.Success(new List<DeviceLimitDto>());

                // One round-trip each — fine for small (≤ 10) app counts
                var slotCounts = await _dbContext.CustomerAppLicenses
                    .Where(l => l.CustomerId == customerId
                        && l.BillingEndsAt == null
                        && appIds.Contains(l.AppId))
                    .GroupBy(l => l.AppId)
                    .Select(g => new { AppId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.AppId, x => x.Count);

                var deviceCounts = await _dbContext.CustomerDevices
                    .Where(d => d.CustomerId == customerId
                        && d.LastLoginDate != null
                        && d.LastLoginDate >= activeFrom
                        && d.AppId != null
                        && appIds.Contains(d.AppId.Value))
                    .GroupBy(d => d.AppId!.Value)
                    .Select(g => new { AppId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.AppId, x => x.Count);

                var result = appIds.Select(appId => new DeviceLimitDto
                {
                    AppId = appId,
                    SlotsTotal = slotCounts.GetValueOrDefault(appId, 0),
                    SlotsUsed = deviceCounts.GetValueOrDefault(appId, 0),
                    CanRegisterNew = deviceCounts.GetValueOrDefault(appId, 0) < slotCounts.GetValueOrDefault(appId, 0),
                    InactiveDays = inactiveDays,
                }).ToList();

                return ApiResponseFactory.Success(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all device limits for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<List<DeviceLimitDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<WebAppUserLimitDto>> CheckWebAppUserLimitAsync(int customerId)
        {
            try
            {
                var webAppId = await _dbContext.Apps
                    .Where(a => a.AppName == "Web App")
                    .Select(a => a.AppId)
                    .FirstOrDefaultAsync();

                if (webAppId == 0)
                {
                    return ApiResponseFactory.Success(new WebAppUserLimitDto
                    {
                        Allowed = true,
                        SlotsTotal = 0,
                        UsersUsed = 0,
                        Reason = "Web App entry missing from dbo.Apps - user limit check skipped.",
                    });
                }

                var slotsTotal = await _dbContext.CustomerAppLicenses
                    .CountAsync(l => l.CustomerId == customerId
                        && l.AppId == webAppId
                        && l.BillingEndsAt == null);

                if (slotsTotal == 0)
                {
                    return ApiResponseFactory.Success(new WebAppUserLimitDto
                    {
                        Allowed = true,
                        SlotsTotal = 0,
                        UsersUsed = 0,
                    });
                }

                var usersUsed = await _dbContext.WebAppUsers
                    .CountAsync(u => u.CustomerId == customerId && u.Status == 1);

                var allowed = usersUsed < slotsTotal;

                return ApiResponseFactory.Success(new WebAppUserLimitDto
                {
                    Allowed = allowed,
                    Reason = allowed ? null
                        : $"Web App user limit reached ({usersUsed}/{slotsTotal}). Add a Web App license or remove an existing user.",
                    SlotsTotal = slotsTotal,
                    UsersUsed = usersUsed,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking Web App user limit for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<WebAppUserLimitDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<WebAppSeatCheckDto>> CheckWebAppSeatAsync(int customerId, int userId)
        {
            try
            {
                // Locate the Web App AppId by name. If your catalog renames it,
                // adjust this string. Done as a query (not cached) since logins
                // are infrequent enough that a single indexed lookup is fine.
                var webAppId = await _dbContext.Apps
                    .Where(a => a.AppName == "Web App")
                    .Select(a => a.AppId)
                    .FirstOrDefaultAsync();

                if (webAppId == 0)
                {
                    // No Web App row in catalog — treat as unlimited so we don't
                    // accidentally lock everyone out of a misconfigured tenant.
                    return ApiResponseFactory.Success(new WebAppSeatCheckDto
                    {
                        Allowed = true,
                        SlotsTotal = 0,
                        SlotsUsed = 0,
                        IsAlreadySeated = false,
                        Reason = "Web App entry missing from dbo.Apps — seat check skipped.",
                    });
                }

                var slotsTotal = await _dbContext.CustomerAppLicenses
                    .CountAsync(l => l.CustomerId == customerId
                        && l.AppId == webAppId
                        && l.BillingEndsAt == null);

                if (slotsTotal == 0)
                {
                    // No Web App licenses allocated → treat as unlimited (consistent
                    // with how the legacy MaxConcurrentUsers=0 means "unlimited").
                    return ApiResponseFactory.Success(new WebAppSeatCheckDto
                    {
                        Allowed = true,
                        SlotsTotal = 0,
                        SlotsUsed = 0,
                        IsAlreadySeated = false,
                    });
                }

                // Active sessions for this customer = currently-seated users.
                // The unique index "IX_UserSessions_ActiveUserCustomer" guarantees
                // at most one active session per (UserId, CustomerId), so the
                // session count equals the distinct user count.
                var slotsUsed = await _dbContext.UserSessions
                    .CountAsync(s => s.CustomerId == customerId && s.IsActive);

                var alreadySeated = await _dbContext.UserSessions
                    .AnyAsync(s => s.UserId == userId
                        && s.CustomerId == customerId
                        && s.IsActive);

                var allowed = alreadySeated || slotsUsed < slotsTotal;

                return ApiResponseFactory.Success(new WebAppSeatCheckDto
                {
                    Allowed = allowed,
                    Reason = allowed ? null
                        : $"Web App seat limit reached ({slotsUsed}/{slotsTotal}). Ask your administrator to add a Web App license or end an existing session.",
                    SlotsTotal = slotsTotal,
                    SlotsUsed = slotsUsed,
                    IsAlreadySeated = alreadySeated,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking Web App seat for customer {CustomerId}, user {UserId}", customerId, userId);
                return ApiResponseFactory.InternalError<WebAppSeatCheckDto>(ex.Message);
            }
        }

        // Counts active devices vs allocated slots for one (customer, app).
        // "Active" = LastLoginDate within the device_inactive_days window; older
        // devices implicitly free their slot for new registrations.
        private async Task<(int used, int total)> CountSlotsAsync(int customerId, int appId, DateTime activeFrom)
        {
            var total = await _dbContext.CustomerAppLicenses
                .CountAsync(l => l.CustomerId == customerId
                    && l.AppId == appId
                    && l.BillingEndsAt == null);

            var used = await _dbContext.CustomerDevices
                .CountAsync(d => d.CustomerId == customerId
                    && d.AppId == appId
                    && d.LastLoginDate != null
                    && d.LastLoginDate >= activeFrom);

            return (used, total);
        }

        private async Task<int> GetInactiveDaysThresholdAsync()
        {
            var raw = await _dbContext.BillingConfigs
                .Where(c => c.ConfigKey == "device_inactive_days")
                .Select(c => c.ConfigValue)
                .FirstOrDefaultAsync();
            return int.TryParse(raw, out var d) && d > 0 ? d : 30;
        }

        public async Task<ApiResponse<bool>> CheckLimitAsync(int customerId, string metricType)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<bool>("Customer not found.");

                if (customer.Subscription?.PlanId == null)
                    return ApiResponseFactory.BadRequest<bool>("Customer has no plan assigned.");

                var today = DateTime.UtcNow.Date;
                var monthStart = new DateTime(today.Year, today.Month, 1);

                // Find the plan app pricing that matches the metric type
                var planAppPricing = await _dbContext.PlanAppPricings
                    .FirstOrDefaultAsync(p => p.PlanId == customer.Subscription.PlanId && p.PricingModel == metricType);

                // Check for customer-level override
                var customerApp = await _dbContext.CustomerApps
                    .FirstOrDefaultAsync(ca => ca.CustomerId == customerId &&
                        (planAppPricing == null || ca.AppId == planAppPricing.AppId));

                var maxLimit = customerApp?.DeviceLimitOverride
                    ?? planAppPricing?.MaxUnits
                    ?? 0;

                if (maxLimit == 0)
                    return ApiResponseFactory.Success(true, "No limit configured (unlimited).");

                var currentUsage = await _dbContext.UsageRecords
                    .Where(u => u.CustomerId == customerId &&
                                u.MetricType == metricType &&
                                u.RecordedDate >= monthStart)
                    .OrderByDescending(u => u.RecordedDate)
                    .Select(u => u.Count)
                    .FirstOrDefaultAsync();

                var withinLimit = currentUsage < maxLimit;
                return ApiResponseFactory.Success(withinLimit,
                    withinLimit ? "Within limit." : $"Limit exceeded ({currentUsage}/{maxLimit}).");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking limit for customer {CustomerId}, metric {MetricType}", customerId, metricType);
                return ApiResponseFactory.InternalError<bool>($"Error checking limit: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<TransactionRecordDto>>> GetTransactionDetailsAsync(int customerId)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<List<TransactionRecordDto>>("Customer not found.");

                // No plan → empty list rather than 400, same pattern as CalculateEstimatedBillAsync.
                if (customer.Subscription == null)
                    return ApiResponseFactory.Success(new List<TransactionRecordDto>(), "No plan; no transactions.");

                // Compute the current billing cycle window the same way BillingService does.
                var billingCycleMonths = Math.Max(1, customer.Subscription.BillingCycleMonths);
                var billingPeriodStart = customer.Subscription.StartDate ?? DateTime.UtcNow.Date;
                var billingPeriodEnd = billingPeriodStart.AddMonths(billingCycleMonths);
                while (billingPeriodEnd <= DateTime.UtcNow)
                {
                    billingPeriodStart = billingPeriodEnd;
                    billingPeriodEnd = billingPeriodStart.AddMonths(billingCycleMonths);
                }

                // Resolve transaction free-tier + rate from BillingConfigs (same source as
                // the estimate). Defaults to 0 if not configured.
                var txFreeTierStr = await _dbContext.BillingConfigs
                    .Where(c => c.ConfigKey == "TransactionFreeTier")
                    .Select(c => c.ConfigValue)
                    .FirstOrDefaultAsync();
                var txRateStr = await _dbContext.BillingConfigs
                    .Where(c => c.ConfigKey == "TransactionRate")
                    .Select(c => c.ConfigValue)
                    .FirstOrDefaultAsync();
                int.TryParse(txFreeTierStr, out var transactionFreeTier);
                decimal.TryParse(txRateStr, out var transactionRate);

                // Pull per-day records for the cycle. UsageRecord is granular at (Customer, AppId, Date).
                var rows = await _dbContext.UsageRecords
                    .Where(u => u.CustomerId == customerId
                        && u.MetricType == "transaction"
                        && u.RecordedDate >= billingPeriodStart
                        && u.RecordedDate < billingPeriodEnd)
                    .OrderByDescending(u => u.RecordedDate)
                    .Select(u => new { u.RecordedDate, u.Count, u.AppId })
                    .ToListAsync();

                // Optional: resolve AppName per record (cheap lookup, small set in practice).
                var appIds = rows.Where(r => r.AppId.HasValue).Select(r => r.AppId!.Value).Distinct().ToList();
                var appNameMap = appIds.Count > 0
                    ? await _dbContext.Apps
                        .Where(a => appIds.Contains(a.Id))
                        .ToDictionaryAsync(a => a.Id, a => a.AppName)
                    : new Dictionary<int, string>();

                // Allocate the free-tier across days oldest-first so each daily row knows
                // how many of its transactions are free vs billable. Mirrors what the
                // aggregate calc does, but lets the UI show the breakdown per row.
                var ordered = rows.OrderBy(r => r.RecordedDate).ToList();
                var remainingFree = transactionFreeTier;
                var result = new List<TransactionRecordDto>(ordered.Count);
                foreach (var r in ordered)
                {
                    var free = Math.Min(remainingFree, r.Count);
                    remainingFree -= free;
                    var billable = r.Count - free;
                    result.Add(new TransactionRecordDto
                    {
                        RecordedDate = r.RecordedDate,
                        Count = r.Count,
                        FreeUnits = free,
                        BillableUnits = billable,
                        UnitPrice = transactionRate,
                        LineTotal = billable * transactionRate,
                        AppId = r.AppId,
                        AppName = r.AppId.HasValue && appNameMap.TryGetValue(r.AppId.Value, out var n) ? n : null
                    });
                }

                // Return newest-first for the UI (matches Invoice History ordering).
                result.Reverse();

                return ApiResponseFactory.Success(result, $"{result.Count} transaction record(s).");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching transaction details for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<List<TransactionRecordDto>>($"Error: {ex.Message}");
            }
        }
    }
}
