using BackOffice.Application.Configuration;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Enums;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;

namespace BackOffice.Persistence.Services.Main
{
    public class StripeCatalogService : IStripeCatalogService
    {
        private readonly MainDBContext _db;
        private readonly StripeSettings _settings;
        private readonly ILogger<StripeCatalogService> _logger;

        public StripeCatalogService(
            MainDBContext db,
            IOptions<StripeSettings> settings,
            ILogger<StripeCatalogService> logger)
        {
            _db = db;
            _settings = settings.Value;
            _logger = logger;

            if (!string.IsNullOrWhiteSpace(_settings.SecretKey))
                StripeConfiguration.ApiKey = _settings.SecretKey;
        }

        public async Task<ApiResponse<int>> SyncAllPlansAsync()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<int>("Stripe is not configured.");

                var plans = await _db.Plans
                    .Include(p => p.PlanAppPricings)
                    .Where(p => p.IsActive)
                    .ToListAsync();

                int synced = 0;
                foreach (var plan in plans)
                {
                    var changed = await SyncSinglePlanInternalAsync(plan);
                    if (changed) synced++;
                }

                if (synced > 0)
                    await _db.SaveChangesAsync();

                return ApiResponseFactory.Success(synced, $"Synced {synced} plan(s).");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error during plan catalog sync");
                return ApiResponseFactory.InternalError<int>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during plan catalog sync");
                return ApiResponseFactory.InternalError<int>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> SyncPlanAsync(int planId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");

                var plan = await _db.Plans
                    .Include(p => p.PlanAppPricings)
                    .FirstOrDefaultAsync(p => p.Id == planId);
                if (plan == null)
                    return ApiResponseFactory.NotFound<bool>("Plan not found.");

                var changed = await SyncSinglePlanInternalAsync(plan);
                if (changed)
                    await _db.SaveChangesAsync();

                return ApiResponseFactory.Success(changed, changed ? "Plan synced." : "Plan already up to date.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error syncing plan {PlanId}", planId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing plan {PlanId}", planId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        // Returns true if anything was created/updated.
        private async Task<bool> SyncSinglePlanInternalAsync(BackOffice.Domain.Entities.Main.Plan plan)
        {
            var changed = false;
            var currency = string.IsNullOrWhiteSpace(_settings.Currency) ? "usd" : _settings.Currency;

            // 1. Product — created once per Plan.
            if (string.IsNullOrWhiteSpace(plan.StripeProductId))
            {
                var productSvc = new ProductService();
                var product = await productSvc.CreateAsync(new ProductCreateOptions
                {
                    Name = plan.Name,
                    Description = plan.Description,
                    Metadata = new Dictionary<string, string>
                    {
                        ["plan_id"] = plan.Id.ToString(),
                        ["plan_code"] = plan.Code
                    }
                });
                plan.StripeProductId = product.Id;
                changed = true;
                _logger.LogInformation("Created Stripe Product {ProductId} for plan {PlanId} ({PlanName})",
                    product.Id, plan.Id, plan.Name);
            }

            // 2. Monthly Price — required if Plan.Price > 0.
            // Stripe Prices are immutable; if our Plan price changes we create a new Price.
            if (plan.Price > 0 && string.IsNullOrWhiteSpace(plan.StripeMonthlyPriceId))
            {
                var priceSvc = new PriceService();
                var price = await priceSvc.CreateAsync(new PriceCreateOptions
                {
                    Product = plan.StripeProductId,
                    UnitAmount = (long)(plan.Price * 100m), // Stripe uses smallest currency unit
                    Currency = currency,
                    Recurring = new PriceRecurringOptions
                    {
                        Interval = "month"
                    },
                    Nickname = $"{plan.Name} (monthly)",
                    Metadata = new Dictionary<string, string>
                    {
                        ["plan_id"] = plan.Id.ToString(),
                        ["billing_cycle"] = "monthly"
                    }
                });
                plan.StripeMonthlyPriceId = price.Id;
                changed = true;
                _logger.LogInformation("Created Stripe Price {PriceId} for plan {PlanId} (monthly)",
                    price.Id, plan.Id);
            }

            // 3. Yearly Price — only if BillingCycle on the plan supports it.
            // Currently we don't store a yearly price separately; this is a hook for future use.
            // To enable: set plan.BillingCycle = Yearly OR add a YearlyPrice column on Plan.
            // For now, skip yearly auto-creation — Phase 1 is monthly-only.

            // 4. Overage Prices — one recurring Stripe Price per non-flat PlanAppPricing row
            // that has a non-zero PricePerUnit. These are charged via Subscription Items
            // with quantity = (consumed - FreeUnits) when the customer buys add-on capacity.
            // Like base Prices, Stripe Prices are immutable; if PricePerUnit changes later,
            // null out the StripeOveragePriceId in the DB and re-run sync to create a new one.
            foreach (var pap in plan.PlanAppPricings ?? new List<PlanAppPricing>())
            {
                var needsPrice = pap.IsIncluded
                    && pap.PricePerUnit > 0
                    && !string.Equals(pap.PricingModel, "flat", StringComparison.OrdinalIgnoreCase)
                    && string.IsNullOrWhiteSpace(pap.StripeOveragePriceId);

                if (!needsPrice) continue;

                if (string.IsNullOrWhiteSpace(plan.StripeProductId))
                {
                    _logger.LogWarning("Cannot create overage Price for plan {PlanId} app {AppId}: parent product not yet synced",
                        plan.Id, pap.AppId);
                    continue;
                }

                var priceSvc = new PriceService();
                var overagePrice = await priceSvc.CreateAsync(new PriceCreateOptions
                {
                    Product = plan.StripeProductId,
                    UnitAmount = (long)(pap.PricePerUnit * 100m),
                    Currency = currency,
                    Recurring = new PriceRecurringOptions
                    {
                        Interval = "month",
                        UsageType = "licensed"
                    },
                    Nickname = $"{plan.Name} — extra {pap.PricingModel.Replace("per_", "")} (monthly)",
                    Metadata = new Dictionary<string, string>
                    {
                        ["plan_id"] = plan.Id.ToString(),
                        ["app_id"] = pap.AppId.ToString(),
                        ["pricing_model"] = pap.PricingModel,
                        ["overage"] = "true"
                    }
                });

                pap.StripeOveragePriceId = overagePrice.Id;
                pap.UpdatedAt = DateTime.UtcNow;
                changed = true;
                _logger.LogInformation("Created Stripe overage Price {PriceId} for plan {PlanId} app {AppId} ({Model} @ {Rate})",
                    overagePrice.Id, plan.Id, pap.AppId, pap.PricingModel, pap.PricePerUnit);
            }

            return changed;
        }
    }
}
