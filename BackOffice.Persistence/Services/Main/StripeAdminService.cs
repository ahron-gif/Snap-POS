using BackOffice.Application.Configuration;
using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Enums;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;
// Aliases to avoid collisions with BackOffice.Domain.Entities.Main namesakes.
using StripeSubscription = Stripe.Subscription;
using StripeInvoice = Stripe.Invoice;

namespace BackOffice.Persistence.Services.Main
{
    public class StripeAdminService : IStripeAdminService
    {
        private readonly MainDBContext _db;
        private readonly IStripeCatalogService _catalogService;
        private readonly IStripeCheckoutService _checkoutService;
        private readonly StripeSettings _settings;
        private readonly ILogger<StripeAdminService> _logger;

        public StripeAdminService(
            MainDBContext db,
            IStripeCatalogService catalogService,
            IStripeCheckoutService checkoutService,
            IOptions<StripeSettings> settings,
            ILogger<StripeAdminService> logger)
        {
            _db = db;
            _catalogService = catalogService;
            _checkoutService = checkoutService;
            _settings = settings.Value;
            _logger = logger;

            if (!string.IsNullOrWhiteSpace(_settings.SecretKey))
                StripeConfiguration.ApiKey = _settings.SecretKey;
        }

        public async Task<ApiResponse<AdminSubscriptionDetailDto>> GetSubscriptionDetailAsync(int customerId)
        {
            try
            {
                var customer = await _db.Customers
                    .Include(c => c.Subscription).ThenInclude(s => s!.Plan)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<AdminSubscriptionDetailDto>("Customer not found.");

                var sub = customer.Subscription;
                var dto = new AdminSubscriptionDetailDto
                {
                    CustomerId = customer.CustomerId,
                    CustomerName = customer.CustomerName,
                    StripeCustomerId = customer.StripeCustomerId,
                    StripeSubscriptionId = sub?.StripeSubscriptionId,
                    PlanId = sub?.PlanId ?? 0,
                    PlanName = sub?.Plan?.Name ?? string.Empty,
                    MonthlyAmount = sub?.Plan?.Price ?? 0,
                    Status = sub != null ? sub.Status.ToString() : "None",
                    CurrentPeriodStart = sub?.CurrentPeriodStart,
                    CurrentPeriodEnd = sub?.CurrentPeriodEnd,
                    CancelAtPeriodEnd = sub?.CancelAtPeriodEnd ?? false,
                    CanceledAt = sub?.CanceledAt,
                    PauseCollectionBehavior = sub?.PauseCollectionBehavior,
                    DefaultPaymentMethodId = sub?.DefaultPaymentMethodId,
                    LastPaymentAt = sub?.LastPaymentAt,
                    IsPaid = sub?.IsPaid ?? false
                };

                // Best-effort enrich with live Stripe data (sub status, card brand/last4).
                if (!string.IsNullOrWhiteSpace(sub?.StripeSubscriptionId)
                    && !string.IsNullOrWhiteSpace(_settings.SecretKey))
                {
                    try
                    {
                        var subSvc = new Stripe.SubscriptionService();
                        var stripeSub = await subSvc.GetAsync(sub.StripeSubscriptionId);
                        dto.StripeStatus = stripeSub.Status;

                        if (!string.IsNullOrWhiteSpace(stripeSub.DefaultPaymentMethodId))
                        {
                            var pmSvc = new PaymentMethodService();
                            var pm = await pmSvc.GetAsync(stripeSub.DefaultPaymentMethodId);
                            dto.DefaultPaymentMethodBrand = pm.Card?.Brand;
                            dto.DefaultPaymentMethodLast4 = pm.Card?.Last4;
                        }
                    }
                    catch (StripeException ex)
                    {
                        _logger.LogWarning(ex, "Admin detail: Stripe lookup failed for sub {SubId}", sub.StripeSubscriptionId);
                    }
                }

                return ApiResponseFactory.Success(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetSubscriptionDetail failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<AdminSubscriptionDetailDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> ChangePlanAsync(int customerId, int adminUserId, AdminChangePlanDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");

                var sub = await _db.Subscriptions
                    .Include(s => s.Plan)
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);
                if (sub == null)
                    return ApiResponseFactory.NotFound<bool>("Customer has no subscription record.");

                var previousPlanId = sub.PlanId;

                // Make sure the new plan has Stripe Product/Price IDs (auto-sync if missing).
                var newPlan = await EnsurePlanSyncedAsync(dto.NewPlanId);
                if (newPlan == null || !newPlan.IsActive)
                    return ApiResponseFactory.NotFound<bool>("Plan not found or inactive.");

                var prorationBehavior = NormalizeProrationBehavior(dto.ProrationBehavior);
                string message;

                if (!string.IsNullOrWhiteSpace(sub.StripeSubscriptionId)
                    && !string.IsNullOrWhiteSpace(newPlan.StripeMonthlyPriceId))
                {
                    // Stripe-aware path: update the existing Stripe subscription.
                    var subSvc = new Stripe.SubscriptionService();
                    var current = await subSvc.GetAsync(sub.StripeSubscriptionId);
                    var existingItem = current.Items?.Data?.FirstOrDefault();
                    if (existingItem == null)
                        return ApiResponseFactory.InternalError<bool>("Stripe subscription has no items.");

                    var updated = await subSvc.UpdateAsync(sub.StripeSubscriptionId, new SubscriptionUpdateOptions
                    {
                        Items = new List<SubscriptionItemOptions>
                        {
                            new SubscriptionItemOptions
                            {
                                Id = existingItem.Id,
                                Price = newPlan.StripeMonthlyPriceId
                            }
                        },
                        ProrationBehavior = prorationBehavior,
                        Metadata = new Dictionary<string, string>
                        {
                            ["customer_id"] = customerId.ToString(),
                            ["plan_id"] = newPlan.Id.ToString(),
                            ["changed_by_admin_user_id"] = adminUserId.ToString(),
                            ["change_notes"] = dto.Notes ?? ""
                        }
                    });

                    // Mirror inline so the admin UI updates immediately. Webhook will also fire.
                    await MirrorSubscriptionToDbAsync(updated, sub);

                    // Stripe just generated a proration invoice for this change. Pull it
                    // inline so the admin's Invoices table reflects the charge immediately,
                    // without waiting for a webhook (which can't reach localhost dev).
                    if (_checkoutService is StripeCheckoutService concrete)
                    {
                        await concrete.TryMirrorLatestInvoiceForSubAsync(updated);
                    }
                    message = $"Plan updated in Stripe with proration_behavior={prorationBehavior}.";
                }
                else
                {
                    // Legacy: no Stripe subscription, direct DB update.
                    sub.PlanId = newPlan.Id;
                    sub.Status = SubscriptionStatus.Active;
                    sub.StartDate ??= DateTime.UtcNow;
                    sub.EndDate = DateTime.UtcNow.AddMonths(Math.Max(1, sub.BillingCycleMonths));
                    message = "Plan updated locally only — customer has no Stripe subscription.";
                }

                _db.SubscriptionHistories.Add(new SubscriptionHistory
                {
                    CustomerId = customerId,
                    PlanId = newPlan.Id,
                    Action = newPlan.Price > (sub.Plan?.Price ?? 0)
                        ? SubscriptionAction.Upgraded
                        : SubscriptionAction.Downgraded,
                    PreviousPlanId = previousPlanId,
                    MonthlyAmount = newPlan.Price,
                    EffectiveDate = DateTime.UtcNow,
                    EndDate = sub.EndDate,
                    Notes = dto.Notes,
                    ChangedBy = adminUserId,
                    ChangedByRole = "admin",
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
                return ApiResponseFactory.Success(true, message);
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error in admin ChangePlan for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin ChangePlan failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<UpcomingInvoicePreviewDto>> PreviewPlanChangeAsync(int customerId, int newPlanId)
        {
            // Reuse the tenant-facing preview — it accepts customerId.
            return await _checkoutService.PreviewPlanChangeAsync(customerId, newPlanId);
        }

        public async Task<ApiResponse<bool>> CancelAsync(int customerId, int adminUserId, AdminCancelDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");

                var sub = await _db.Subscriptions
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);
                if (sub == null)
                    return ApiResponseFactory.NotFound<bool>("Customer has no subscription record.");

                string message;

                if (!string.IsNullOrWhiteSpace(sub.StripeSubscriptionId))
                {
                    var subSvc = new Stripe.SubscriptionService();
                    if (dto.Immediately)
                    {
                        // Immediate cancel with prorated refund for unused time.
                        var canceled = await subSvc.CancelAsync(sub.StripeSubscriptionId, new SubscriptionCancelOptions
                        {
                            Prorate = true,
                            InvoiceNow = false
                        });
                        await MirrorSubscriptionToDbAsync(canceled, sub);
                        sub.Status = SubscriptionStatus.Cancelled;
                        sub.IsPaid = false;
                        message = "Subscription canceled immediately. Prorated refund applied.";
                    }
                    else
                    {
                        var updated = await subSvc.UpdateAsync(sub.StripeSubscriptionId, new SubscriptionUpdateOptions
                        {
                            CancelAtPeriodEnd = true
                        });
                        await MirrorSubscriptionToDbAsync(updated, sub);
                        message = "Subscription will end at the current period.";
                    }
                }
                else
                {
                    sub.Status = SubscriptionStatus.Cancelled;
                    sub.IsPaid = false;
                    sub.CanceledAt = DateTime.UtcNow;
                    message = "Subscription marked canceled locally only — no Stripe sub to cancel.";
                }

                _db.SubscriptionHistories.Add(new SubscriptionHistory
                {
                    CustomerId = customerId,
                    PlanId = sub.PlanId,
                    Action = SubscriptionAction.Cancelled,
                    MonthlyAmount = 0,
                    EffectiveDate = DateTime.UtcNow,
                    Notes = dto.Notes,
                    ChangedBy = adminUserId,
                    ChangedByRole = "admin",
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
                return ApiResponseFactory.Success(true, message);
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error in admin Cancel for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin Cancel failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> ReactivateAsync(int customerId, int adminUserId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");

                var sub = await _db.Subscriptions
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);
                if (sub == null)
                    return ApiResponseFactory.NotFound<bool>("Customer has no subscription record.");

                if (string.IsNullOrWhiteSpace(sub.StripeSubscriptionId))
                    return ApiResponseFactory.BadRequest<bool>(
                        "No Stripe subscription to reactivate. Customer must subscribe again.");

                var subSvc = new Stripe.SubscriptionService();
                var updated = await subSvc.UpdateAsync(sub.StripeSubscriptionId, new SubscriptionUpdateOptions
                {
                    CancelAtPeriodEnd = false
                });
                await MirrorSubscriptionToDbAsync(updated, sub);

                _db.SubscriptionHistories.Add(new SubscriptionHistory
                {
                    CustomerId = customerId,
                    PlanId = sub.PlanId,
                    Action = SubscriptionAction.Reactivated,
                    MonthlyAmount = 0,
                    EffectiveDate = DateTime.UtcNow,
                    ChangedBy = adminUserId,
                    ChangedByRole = "admin",
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Subscription reactivated.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error in admin Reactivate for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin Reactivate failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> PauseAsync(int customerId, int adminUserId, AdminPauseDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");

                var sub = await _db.Subscriptions
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);
                if (sub == null)
                    return ApiResponseFactory.NotFound<bool>("Customer has no subscription record.");

                if (string.IsNullOrWhiteSpace(sub.StripeSubscriptionId))
                    return ApiResponseFactory.BadRequest<bool>("No Stripe subscription to pause.");

                var behavior = string.IsNullOrWhiteSpace(dto.Behavior) ? "keep_as_draft" : dto.Behavior;

                var subSvc = new Stripe.SubscriptionService();
                var updated = await subSvc.UpdateAsync(sub.StripeSubscriptionId, new SubscriptionUpdateOptions
                {
                    PauseCollection = new SubscriptionPauseCollectionOptions
                    {
                        Behavior = behavior
                    }
                });
                await MirrorSubscriptionToDbAsync(updated, sub);
                sub.PauseCollectionBehavior = behavior;

                _db.SubscriptionHistories.Add(new SubscriptionHistory
                {
                    CustomerId = customerId,
                    PlanId = sub.PlanId,
                    Action = SubscriptionAction.Suspended,
                    MonthlyAmount = 0,
                    EffectiveDate = DateTime.UtcNow,
                    Notes = dto.Notes ?? $"Stripe pause_collection={behavior}",
                    ChangedBy = adminUserId,
                    ChangedByRole = "admin",
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
                return ApiResponseFactory.Success(true, $"Stripe collection paused ({behavior}).");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error in admin Pause for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin Pause failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> ResumeAsync(int customerId, int adminUserId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");

                var sub = await _db.Subscriptions
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);
                if (sub == null)
                    return ApiResponseFactory.NotFound<bool>("Customer has no subscription record.");

                if (string.IsNullOrWhiteSpace(sub.StripeSubscriptionId))
                    return ApiResponseFactory.BadRequest<bool>("No Stripe subscription to resume.");

                var subSvc = new Stripe.SubscriptionService();
                // Pass null to clear pause_collection.
                var updated = await subSvc.UpdateAsync(sub.StripeSubscriptionId, new SubscriptionUpdateOptions
                {
                    PauseCollection = null
                });
                await MirrorSubscriptionToDbAsync(updated, sub);
                sub.PauseCollectionBehavior = null;
                sub.Status = SubscriptionStatus.Active;

                _db.SubscriptionHistories.Add(new SubscriptionHistory
                {
                    CustomerId = customerId,
                    PlanId = sub.PlanId,
                    Action = SubscriptionAction.Reactivated,
                    MonthlyAmount = 0,
                    EffectiveDate = DateTime.UtcNow,
                    Notes = "Stripe pause_collection cleared",
                    ChangedBy = adminUserId,
                    ChangedByRole = "admin",
                    CreatedAt = DateTime.UtcNow
                });

                await _db.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Stripe collection resumed.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error in admin Resume for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin Resume failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<int>> SyncInvoicesFromStripeAsync(int customerId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<int>("Stripe is not configured.");

                var customer = await _db.Customers.FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<int>("Customer not found.");
                if (string.IsNullOrWhiteSpace(customer.StripeCustomerId))
                    return ApiResponseFactory.BadRequest<int>("Customer has no Stripe Customer id.");

                // The mirror helper lives on StripeCheckoutService — call it via the injected reference.
                // (Cast to concrete type to access internal method.)
                if (_checkoutService is not StripeCheckoutService concreteCheckout)
                    return ApiResponseFactory.InternalError<int>("Internal: checkout service not the expected concrete type.");

                var invoiceSvc = new InvoiceService();
                var listOptions = new InvoiceListOptions
                {
                    Customer = customer.StripeCustomerId,
                    Limit = 100
                };

                int synced = 0;
                await foreach (var stripeInvoice in invoiceSvc.ListAutoPagingAsync(listOptions))
                {
                    try
                    {
                        await concreteCheckout.MirrorInvoiceFromStripeAsync(stripeInvoice);
                        synced++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "SyncInvoices: mirror failed for Stripe invoice {InvoiceId}", stripeInvoice.Id);
                    }
                }

                return ApiResponseFactory.Success(synced, $"Synced {synced} invoice(s) from Stripe.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error syncing invoices for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<int>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SyncInvoices failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<int>(ex.Message);
            }
        }

        public async Task<ApiResponse<InvoiceSummaryDto>> CreateTestInvoiceAsync(int customerId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<InvoiceSummaryDto>("Stripe is not configured.");

                // Hard safety gate — never let this run in production.
                if (!_settings.SecretKey.StartsWith("sk_test_", StringComparison.Ordinal))
                    return ApiResponseFactory.BadRequest<InvoiceSummaryDto>(
                        "Test invoices can only be created with a Stripe test-mode key (sk_test_...).");

                var customer = await _db.Customers.FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<InvoiceSummaryDto>("Customer not found.");
                if (string.IsNullOrWhiteSpace(customer.StripeCustomerId))
                    return ApiResponseFactory.BadRequest<InvoiceSummaryDto>(
                        "Customer has no Stripe Customer id. Run a Subscribe checkout first so we create one.");

                var currency = string.IsNullOrWhiteSpace(_settings.Currency) ? "usd" : _settings.Currency;
                var stamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

                // 1. Pending invoice item (one-off $1.00 line). This is what makes the
                //    next invoice for this customer non-empty.
                var itemSvc = new InvoiceItemService();
                var item = await itemSvc.CreateAsync(new InvoiceItemCreateOptions
                {
                    Customer = customer.StripeCustomerId,
                    Amount = 100, // 100 cents = $1.00
                    Currency = currency,
                    Description = $"Test charge ({stamp} UTC)"
                });

                // 2. Create the invoice. AutoAdvance=false so Stripe doesn't try to
                //    charge or finalize on its own — we drive both steps explicitly.
                var invSvc = new InvoiceService();
                var invoice = await invSvc.CreateAsync(new InvoiceCreateOptions
                {
                    Customer = customer.StripeCustomerId,
                    AutoAdvance = false,
                    CollectionMethod = "send_invoice",
                    DaysUntilDue = 30,
                    Description = "Test invoice — generated by Back Office QA tool",
                    Metadata = new Dictionary<string, string>
                    {
                        { "test_invoice", "true" },
                        { "customer_id", customerId.ToString() },
                        { "source", "back_office_admin_qa" }
                    }
                });

                // 3. Finalize — locks line items, produces HostedInvoiceUrl + InvoicePdf.
                invoice = await invSvc.FinalizeInvoiceAsync(invoice.Id);

                // 4. Mark paid out-of-band so status becomes "paid" without actually
                //    charging a card. Test mode never moves real money, but this also
                //    keeps the invoice from sitting "open" if the customer has no PM.
                invoice = await invSvc.PayAsync(invoice.Id, new InvoicePayOptions
                {
                    PaidOutOfBand = true
                });

                // 5. Mirror inline. Webhooks may also fire (invoice.finalized + invoice.paid)
                //    but for localhost dev without a tunnel we can't rely on them — the
                //    inline mirror guarantees the row exists before we return.
                if (_checkoutService is not StripeCheckoutService concreteCheckout)
                    return ApiResponseFactory.InternalError<InvoiceSummaryDto>(
                        "Internal: checkout service not the expected concrete type.");
                await concreteCheckout.MirrorInvoiceFromStripeAsync(invoice);

                // Reload the locally mirrored row so the response matches what the UI
                // will see when it refreshes the invoice list.
                var local = await _db.Invoices
                    .AsNoTracking()
                    .FirstOrDefaultAsync(i => i.StripeInvoiceId == invoice.Id);

                var dto = new InvoiceSummaryDto
                {
                    Id = local?.Id ?? 0,
                    InvoiceNumber = local?.InvoiceNumber ?? invoice.Number ?? invoice.Id,
                    CustomerId = customerId,
                    CustomerName = customer.CustomerName,
                    BillingPeriodStart = local?.BillingPeriodStart ?? invoice.PeriodStart,
                    BillingPeriodEnd = local?.BillingPeriodEnd ?? invoice.PeriodEnd,
                    IssuedAt = local?.IssuedAt ?? invoice.Created,
                    DueDate = local?.DueDate ?? invoice.DueDate ?? invoice.Created,
                    TotalAmount = local?.TotalAmount ?? (invoice.Total / 100m),
                    Status = local?.Status ?? InvoiceStatus.Paid,
                    PaidAt = local?.PaidAt ?? DateTime.UtcNow,
                    HasStripeLink = true
                };

                _logger.LogInformation(
                    "Created test invoice {InvoiceId} ({StripeId}) for customer {CustomerId}",
                    dto.Id, invoice.Id, customerId);

                return ApiResponseFactory.Success(dto, "Test invoice created and paid out-of-band.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error creating test invoice for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<InvoiceSummaryDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateTestInvoice failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<InvoiceSummaryDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> SyncFromStripeAsync(int customerId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");

                var sub = await _db.Subscriptions
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);

                // Resolve the Stripe subscription id. Prefer the local one; otherwise discover
                // the most recent (non-canceled) sub from Stripe via the customer's StripeCustomerId.
                // This lets the super-admin recover after a missed webhook clears the local id but
                // the sub still exists on Stripe's side.
                string? stripeSubId = sub?.StripeSubscriptionId;
                if (string.IsNullOrWhiteSpace(stripeSubId))
                {
                    var customer = await _db.Customers.FirstOrDefaultAsync(c => c.CustomerId == customerId);
                    if (customer == null)
                        return ApiResponseFactory.NotFound<bool>("Customer not found.");
                    if (string.IsNullOrWhiteSpace(customer.StripeCustomerId))
                        return ApiResponseFactory.Success(false, "Customer has no Stripe Customer id; nothing to mirror.");

                    var listSvc = new Stripe.SubscriptionService();
                    var list = await listSvc.ListAsync(new Stripe.SubscriptionListOptions
                    {
                        Customer = customer.StripeCustomerId,
                        Status = "all",
                        Limit = 10,
                    });

                    // Pick the most recent active/paused/past_due/trialing; otherwise the newest record.
                    var preferred = list.Data
                        .OrderByDescending(s => s.Created)
                        .FirstOrDefault(s => s.Status is "active" or "trialing" or "past_due" or "paused")
                        ?? list.Data.OrderByDescending(s => s.Created).FirstOrDefault();

                    if (preferred == null)
                        return ApiResponseFactory.Success(false, "No Stripe subscription found for this customer; nothing to mirror.");

                    stripeSubId = preferred.Id;
                }

                if (sub == null)
                    return ApiResponseFactory.BadRequest<bool>("Local Subscription row missing — create one before syncing.");

                var subSvc = new Stripe.SubscriptionService();
                var stripeSub = await subSvc.GetAsync(stripeSubId);
                await MirrorSubscriptionToDbAsync(stripeSub, sub);
                await _db.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Synced from Stripe.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error in SyncFromStripe for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SyncFromStripe failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        // ─── Helpers ───────────────────────────────────────────────────────

        private static string NormalizeProrationBehavior(string? input)
        {
            var v = (input ?? "").Trim().ToLowerInvariant();
            return v switch
            {
                "none" => "none",
                "always_invoice" => "always_invoice",
                _ => "create_prorations"
            };
        }

        private async Task<BackOffice.Domain.Entities.Main.Plan?> EnsurePlanSyncedAsync(int planId)
        {
            var plan = await _db.Plans.FindAsync(planId);
            if (plan == null) return null;
            if (!string.IsNullOrWhiteSpace(plan.StripeMonthlyPriceId)) return plan;

            _logger.LogInformation("Admin: plan {PlanId} not synced — syncing now", planId);
            var syncResult = await _catalogService.SyncPlanAsync(planId);
            if (!syncResult.IsSuccess)
            {
                _logger.LogError("Admin: auto-sync failed for plan {PlanId}: {Message}", planId, syncResult.Message);
                return plan;
            }
            await _db.Entry(plan).ReloadAsync();
            return plan;
        }

        private static void MirrorSubscriptionToDbCore(StripeSubscription stripeSub, BackOffice.Domain.Entities.Main.Subscription sub)
        {
            var firstItem = stripeSub.Items?.Data?.FirstOrDefault();
            sub.StripeSubscriptionId = stripeSub.Id;
            sub.CurrentPeriodStart = firstItem?.CurrentPeriodStart;
            sub.CurrentPeriodEnd = firstItem?.CurrentPeriodEnd;
            sub.StartDate = firstItem?.CurrentPeriodStart ?? sub.StartDate;
            sub.EndDate = firstItem?.CurrentPeriodEnd ?? sub.EndDate;
            sub.CancelAtPeriodEnd = stripeSub.CancelAtPeriodEnd;
            sub.CanceledAt = stripeSub.CanceledAt;
            sub.DefaultPaymentMethodId = stripeSub.DefaultPaymentMethodId;
            sub.PauseCollectionBehavior = stripeSub.PauseCollection?.Behavior;
        }

        private async Task MirrorSubscriptionToDbAsync(StripeSubscription stripeSub, BackOffice.Domain.Entities.Main.Subscription sub)
        {
            MirrorSubscriptionToDbCore(stripeSub, sub);

            // If price changed, map back to a Plan id.
            var priceId = stripeSub.Items?.Data?.FirstOrDefault()?.Price?.Id;
            if (!string.IsNullOrWhiteSpace(priceId))
            {
                var plan = await _db.Plans.FirstOrDefaultAsync(p =>
                    p.StripeMonthlyPriceId == priceId || p.StripeYearlyPriceId == priceId);
                if (plan != null) sub.PlanId = plan.Id;
            }

            // Domain status mapping.
            sub.Status = stripeSub.Status?.ToLowerInvariant() switch
            {
                "active" => SubscriptionStatus.Active,
                "trialing" => SubscriptionStatus.Trial,
                "past_due" => SubscriptionStatus.PastDue,
                "unpaid" => SubscriptionStatus.PastDue,
                "canceled" => SubscriptionStatus.Cancelled,
                "incomplete" => SubscriptionStatus.PastDue,
                "incomplete_expired" => SubscriptionStatus.Cancelled,
                "paused" => SubscriptionStatus.Suspended,
                _ => sub.Status
            };
        }
    }
}
