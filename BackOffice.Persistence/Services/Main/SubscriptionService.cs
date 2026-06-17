using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Enums;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    public class SubscriptionService : ISubscriptionService
    {
        private readonly MainDBContext _dbContext;
        private readonly ILogger<SubscriptionService> _logger;
        private readonly ICustomerAppLicenseService _licenseService;

        public SubscriptionService(
            MainDBContext dbContext,
            ILogger<SubscriptionService> logger,
            ICustomerAppLicenseService licenseService)
        {
            _dbContext = dbContext;
            _logger = logger;
            _licenseService = licenseService;
        }

        public async Task<ApiResponse<CustomerSubscriptionDetailDto>> GetCurrentSubscriptionAsync(int customerId)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription).ThenInclude(s => s.Plan)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<CustomerSubscriptionDetailDto>("Customer not found.");

                if (customer.Subscription == null)
                    return ApiResponseFactory.NotFound<CustomerSubscriptionDetailDto>("Customer has no active plan.");

                var dto = new CustomerSubscriptionDetailDto
                {
                    CustomerId = customer.CustomerId,
                    CustomerName = customer.CustomerName,
                    PlanId = customer.Subscription.Plan.Id,
                    PlanName = customer.Subscription.Plan.Name,
                    PlanTier = customer.Subscription.Plan.Tier,
                    SubscriptionStatus = customer.Subscription.Status,
                    SubscriptionStartDate = customer.Subscription.StartDate,
                    SubscriptionEndDate = customer.Subscription.EndDate,
                    GracePeriodEndsAt = customer.Subscription.GracePeriodEndsAt,
                    SuspendedAt = customer.Subscription.SuspendedAt,
                    BillingCycleMonths = customer.Subscription.BillingCycleMonths,
                    MonthlyAmount = customer.Subscription.Plan.Price,
                    IsPaid = customer.Subscription.IsPaid,
                    LastPaymentAt = customer.Subscription.LastPaymentAt,
                    StripeSubscriptionId = customer.Subscription.StripeSubscriptionId,
                    CurrentPeriodStart = customer.Subscription.CurrentPeriodStart,
                    CurrentPeriodEnd = customer.Subscription.CurrentPeriodEnd,
                    CancelAtPeriodEnd = customer.Subscription.CancelAtPeriodEnd,
                    CanceledAt = customer.Subscription.CanceledAt
                };

                return ApiResponseFactory.Success(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching current subscription for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CustomerSubscriptionDetailDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> ChangeSubscriptionAsync(ChangeSubscriptionDto dto, int changedBy)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription).ThenInclude(s => s.Plan)
                    .FirstOrDefaultAsync(c => c.CustomerId == dto.CustomerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<bool>("Customer not found.");

                var newPlan = await _dbContext.Plans.FindAsync(dto.NewPlanId);
                if (newPlan == null)
                    return ApiResponseFactory.NotFound<bool>("Plan not found.");

                var previousPlanId = customer.Subscription?.PlanId;
                var oldPrice = customer.Subscription?.Plan?.Price ?? 0;

                SubscriptionAction action;
                if (newPlan.Price > oldPrice)
                    action = SubscriptionAction.Upgraded;
                else if (newPlan.Price < oldPrice)
                    action = SubscriptionAction.Downgraded;
                else
                    action = SubscriptionAction.Upgraded;

                var effectiveDate = dto.EffectiveDate ?? DateTime.UtcNow;

                if (customer.Subscription == null)
                {
                    customer.Subscription = new Subscription
                    {
                        PlanId = newPlan.Id,
                        Status = SubscriptionStatus.Active,
                        StartDate = effectiveDate,
                        EndDate = effectiveDate.AddMonths(1),
                        BillingCycleMonths = 1
                    };
                }
                else
                {
                    customer.Subscription.PlanId = newPlan.Id;
                    customer.Subscription.Status = SubscriptionStatus.Active;
                    customer.Subscription.StartDate = effectiveDate;
                    customer.Subscription.EndDate = effectiveDate.AddMonths(customer.Subscription.BillingCycleMonths);
                }

                var audit = new SubscriptionHistory
                {
                    CustomerId = customer.CustomerId,
                    PlanId = newPlan.Id,
                    Action = action,
                    PreviousPlanId = previousPlanId,
                    MonthlyAmount = newPlan.Price,
                    EffectiveDate = effectiveDate,
                    EndDate = customer.Subscription.EndDate,
                    Notes = dto.Notes,
                    ChangedBy = changedBy,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.SubscriptionHistories.Add(audit);
                await _dbContext.SaveChangesAsync();

                await _licenseService.SyncBaselineLicensesAsync(customer.CustomerId, newPlan.Id, changedBy);

                return ApiResponseFactory.Success(true, "Subscription changed successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error changing subscription for customer {CustomerId}", dto.CustomerId);
                return ApiResponseFactory.InternalError<bool>($"Error changing subscription: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> ApplyAppOverrideAsync(CustomerAppOverrideDto dto)
        {
            try
            {
                var customerApp = await _dbContext.CustomerApps
                    .FirstOrDefaultAsync(ca => ca.CustomerId == dto.CustomerId && ca.AppId == dto.AppId);

                if (customerApp == null)
                {
                    customerApp = new CustomerApp
                    {
                        CustomerId = dto.CustomerId,
                        AppId = dto.AppId,
                        DevicesLimit = 0,
                        DateCreated = DateTime.UtcNow,
                        IsEnabled = dto.IsEnabled,
                        PriceOverride = dto.PriceOverride,
                        DeviceLimitOverride = dto.DeviceLimitOverride,
                        FreeTierOverride = dto.FreeTierOverride
                    };
                    _dbContext.CustomerApps.Add(customerApp);
                }
                else
                {
                    customerApp.PriceOverride = dto.PriceOverride;
                    customerApp.DeviceLimitOverride = dto.DeviceLimitOverride;
                    customerApp.FreeTierOverride = dto.FreeTierOverride;
                    customerApp.IsEnabled = dto.IsEnabled;
                    customerApp.DateModified = DateTime.UtcNow;
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "App override applied successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error applying app override for customer {CustomerId}, app {AppId}", dto.CustomerId, dto.AppId);
                return ApiResponseFactory.InternalError<bool>($"Error applying app override: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> ApplyApiOverrideAsync(CustomerApiOverrideDto dto)
        {
            try
            {
                var apiOverride = await _dbContext.CustomerApiOverrides
                    .FirstOrDefaultAsync(ca => ca.CustomerId == dto.CustomerId && ca.ApiDefinitionId == dto.ApiDefinitionId);

                if (apiOverride == null)
                {
                    apiOverride = new CustomerApiOverride
                    {
                        CustomerId = dto.CustomerId,
                        ApiDefinitionId = dto.ApiDefinitionId,
                        RateOverride = dto.RateOverride,
                        FreeTierOverride = dto.FreeTierOverride,
                        MaxCallsOverride = dto.MaxCallsOverride,
                        IsEnabled = dto.IsEnabled,
                        CreatedAt = DateTime.UtcNow
                    };
                    _dbContext.CustomerApiOverrides.Add(apiOverride);
                }
                else
                {
                    apiOverride.RateOverride = dto.RateOverride;
                    apiOverride.FreeTierOverride = dto.FreeTierOverride;
                    apiOverride.MaxCallsOverride = dto.MaxCallsOverride;
                    apiOverride.IsEnabled = dto.IsEnabled;
                    apiOverride.UpdatedAt = DateTime.UtcNow;
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "API override applied successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error applying API override for customer {CustomerId}, API {ApiDefinitionId}", dto.CustomerId, dto.ApiDefinitionId);
                return ApiResponseFactory.InternalError<bool>($"Error applying API override: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> SuspendCustomerAsync(int customerId, string reason)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<bool>("Customer not found.");

                if (customer.Subscription != null)
                {
                    customer.Subscription.Status = SubscriptionStatus.Suspended;
                    customer.Subscription.SuspendedAt = DateTime.UtcNow;
                }

                var audit = new SubscriptionHistory
                {
                    CustomerId = customer.CustomerId,
                    PlanId = customer.Subscription?.PlanId ?? 0,
                    Action = SubscriptionAction.Suspended,
                    MonthlyAmount = 0,
                    EffectiveDate = DateTime.UtcNow,
                    Notes = reason,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.SubscriptionHistories.Add(audit);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Customer suspended successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error suspending customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>($"Error suspending customer: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> ReactivateCustomerAsync(int customerId)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<bool>("Customer not found.");

                if (customer.Subscription != null)
                {
                    customer.Subscription.Status = SubscriptionStatus.Active;
                    customer.Subscription.GracePeriodEndsAt = null;
                    customer.Subscription.SuspendedAt = null;
                }

                var audit = new SubscriptionHistory
                {
                    CustomerId = customer.CustomerId,
                    PlanId = customer.Subscription?.PlanId ?? 0,
                    Action = SubscriptionAction.Reactivated,
                    MonthlyAmount = 0,
                    EffectiveDate = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.SubscriptionHistories.Add(audit);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Customer reactivated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reactivating customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>($"Error reactivating customer: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<SubscriptionHistoryDto>>> GetSubscriptionHistoryAsync(int customerId)
        {
            try
            {
                var history = await (from cs in _dbContext.SubscriptionHistories
                                    join p in _dbContext.Plans on cs.PlanId equals p.Id
                                    join pp in _dbContext.Plans on cs.PreviousPlanId equals pp.Id into prevPlans
                                    from pp in prevPlans.DefaultIfEmpty()
                                    where cs.CustomerId == customerId
                                    orderby cs.CreatedAt descending
                                    select new SubscriptionHistoryDto
                                    {
                                        Id = cs.Id,
                                        PlanName = p.Name,
                                        Action = cs.Action,
                                        PreviousPlanName = pp != null ? pp.Name : null,
                                        MonthlyAmount = cs.MonthlyAmount,
                                        EffectiveDate = cs.EffectiveDate,
                                        EndDate = cs.EndDate,
                                        Notes = cs.Notes,
                                        ChangedBy = cs.ChangedBy != null ? cs.ChangedBy.ToString() : null,
                                        CreatedAt = cs.CreatedAt
                                    }).ToListAsync();

                return ApiResponseFactory.Success(history);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching subscription history for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<List<SubscriptionHistoryDto>>(ex.Message);
            }
        }
    }
}
