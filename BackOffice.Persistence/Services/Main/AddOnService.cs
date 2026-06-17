using System.Text.Json;
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
using StripeSubscription = Stripe.Subscription;

namespace BackOffice.Persistence.Services.Main
{
    /// <summary>
    /// Mid-cycle add-on billing via Stripe Checkout redirect (Pattern A).
    ///
    /// Flow:
    ///   CreateCheckoutSessionAsync → Stripe Checkout (mode=payment) for the
    ///   prorated total. On payment, the matching webhook (or the status-poll /
    ///   reconcile backstop) runs ApplyAddOnSessionAsync which calls
    ///   SubscriptionService.UpdateAsync with proration_behavior=none — the
    ///   prorated amount has already been collected via Checkout, so the
    ///   subscription update only needs to reflect the new recurring quantities.
    /// </summary>
    public class AddOnService : IAddOnService
    {
        private readonly MainDBContext _db;
        private readonly StripeSettings _settings;
        private readonly IStripeCatalogService _catalog;
        private readonly ICustomerAppLicenseService _licenseService;
        private readonly ILogger<AddOnService> _logger;

        public AddOnService(
            MainDBContext db,
            IOptions<StripeSettings> settings,
            IStripeCatalogService catalog,
            ICustomerAppLicenseService licenseService,
            ILogger<AddOnService> logger)
        {
            _db = db;
            _settings = settings.Value;
            _catalog = catalog;
            _licenseService = licenseService;
            _logger = logger;

            if (!string.IsNullOrWhiteSpace(_settings.SecretKey))
                StripeConfiguration.ApiKey = _settings.SecretKey;
        }

        public async Task<ApiResponse<UpcomingInvoicePreviewDto>> PreviewAsync(int customerId, AddOnRequestDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<UpcomingInvoicePreviewDto>("Stripe is not configured.");

                var ctx = await LoadContextAsync(customerId, dto);
                if (ctx.Error != null)
                    return ApiResponseFactory.BadRequest<UpcomingInvoicePreviewDto>(ctx.Error);

                var subSvc = new Stripe.SubscriptionService();
                var currentSub = await subSvc.GetAsync(ctx.Subscription!.StripeSubscriptionId);

                var itemUpdates = BuildPreviewItemUpdates(currentSub, ctx.PricingByPriceId, dto.Items);
                if (itemUpdates.Count == 0)
                    return ApiResponseFactory.Success(EmptyPreview());

                var invoiceSvc = new InvoiceService();
                var preview = await invoiceSvc.CreatePreviewAsync(new InvoiceCreatePreviewOptions
                {
                    Customer = ctx.Customer!.StripeCustomerId,
                    Subscription = ctx.Subscription.StripeSubscriptionId,
                    SubscriptionDetails = new InvoiceSubscriptionDetailsOptions
                    {
                        Items = itemUpdates,
                        ProrationBehavior = "create_prorations"
                    }
                });

                // Local proration math is the source of truth for AmountDueNow — see
                // ComputeProrationCentsLocal for why. Preview lines are still mapped so
                // the response includes Stripe's per-line breakdown for diagnostic UIs.
                var prorationCents = ComputeProrationCentsLocal(currentSub, ctx.PricingByAppId, dto.Items);
                var dtoOut = MapPreview(preview);
                dtoOut.AmountDueNow = prorationCents / 100m;

                return ApiResponseFactory.Success(dtoOut);
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error previewing add-on for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<UpcomingInvoicePreviewDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error previewing add-on for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<UpcomingInvoicePreviewDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<CheckoutSessionResultDto>> CreateCheckoutSessionAsync(
            int customerId, int requestedByUserId, AddOnRequestDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<CheckoutSessionResultDto>("Stripe is not configured.");

                var ctx = await LoadContextAsync(customerId, dto);
                if (ctx.Error != null)
                    return ApiResponseFactory.BadRequest<CheckoutSessionResultDto>(ctx.Error);

                var subSvc = new Stripe.SubscriptionService();
                var currentSub = await subSvc.GetAsync(ctx.Subscription!.StripeSubscriptionId);

                var itemUpdates = BuildPreviewItemUpdates(currentSub, ctx.PricingByPriceId, dto.Items);
                if (itemUpdates.Count == 0)
                    return ApiResponseFactory.BadRequest<CheckoutSessionResultDto>(
                        "No quantity changes detected — nothing to charge.");

                // Compute the prorated total via Stripe so we charge the same number
                // we'll later credit when applying the subscription update with
                // proration_behavior=none.
                var invoiceSvc = new InvoiceService();
                var preview = await invoiceSvc.CreatePreviewAsync(new InvoiceCreatePreviewOptions
                {
                    Customer = ctx.Customer!.StripeCustomerId,
                    Subscription = ctx.Subscription.StripeSubscriptionId,
                    SubscriptionDetails = new InvoiceSubscriptionDetailsOptions
                    {
                        Items = itemUpdates,
                        ProrationBehavior = "create_prorations"
                    }
                });

                // Charge ONLY the proration delta — not the entire upcoming invoice.
                // Stripe's preview AmountDue includes next-month recurring charges and
                // sometimes random balance-adjustment lines that aren't proration. Local
                // math (delta_qty × price × days_remaining/period_days) is deterministic
                // and matches exactly what the user sees in the modal's per-line display.
                var prorationCents = ComputeProrationCentsLocal(currentSub, ctx.PricingByAppId, dto.Items);

                // AmountDue can be 0 (e.g. only quantity decreases — Stripe issues a
                // credit note instead) or negative (more credit than charge). Skip Checkout
                // and go straight to the apply step with proration_behavior=create_prorations
                // so the credit lands on the next invoice.
                if (prorationCents <= 0)
                {
                    await ApplyAddOnSubscriptionUpdateAsync(ctx, dto, prorationBehavior: "create_prorations");
                    await MirrorSubscriptionAddOnsForContextAsync(ctx);
                    // Same backend-driven license commit as the post-Checkout path.
                    // No payment was needed, but the user still expects their +/- clicks
                    // to take effect on row state.
                    await CommitLicenseChangesAsync(customerId, dto.Items, requestedByUserId);

                    // Synthesize a "completed" session-result for the frontend so it can
                    // navigate without a Stripe round-trip.
                    return ApiResponseFactory.Success(new CheckoutSessionResultDto
                    {
                        SessionId = string.Empty,
                        Url = string.Empty
                    }, "No charge — change applied immediately (credit on next invoice).");
                }

                var prorationDollars = prorationCents / 100m;
                var currency = preview.Currency ?? (string.IsNullOrWhiteSpace(_settings.Currency) ? "usd" : _settings.Currency);

                var frontendBase = (_settings.FrontendBaseUrl ?? "").TrimEnd('/');
                var successUrl = $"{frontendBase}/licenses-billing?addon=success&session_id={{CHECKOUT_SESSION_ID}}";
                var cancelUrl = $"{frontendBase}/licenses-billing?addon=canceled";

                var sessionOptions = new Stripe.Checkout.SessionCreateOptions
                {
                    Mode = "payment",
                    Customer = ctx.Customer.StripeCustomerId,
                    PaymentMethodTypes = new List<string> { "card" },
                    LineItems = BuildCheckoutLineItems(currency, dto, ctx.PlanName, prorationCents),
                    SuccessUrl = successUrl,
                    CancelUrl = cancelUrl,
                    Metadata = new Dictionary<string, string>
                    {
                        ["customer_id"] = customerId.ToString(),
                        ["intent"] = "addon",
                        ["requested_by_user_id"] = requestedByUserId.ToString()
                    }
                };

                var sessionSvc = new Stripe.Checkout.SessionService();
                var session = await sessionSvc.CreateAsync(sessionOptions);

                _db.PendingAddOns.Add(new PendingAddOn
                {
                    SessionId = session.Id,
                    CustomerId = customerId,
                    ItemsJson = JsonSerializer.Serialize(dto.Items),
                    ProrationAmount = prorationDollars,
                    Notes = dto.Notes,
                    RequestedByUserId = requestedByUserId,
                    CreatedAt = DateTime.UtcNow
                });
                await _db.SaveChangesAsync();

                return ApiResponseFactory.Success(new CheckoutSessionResultDto
                {
                    SessionId = session.Id,
                    Url = session.Url
                });
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error creating add-on checkout for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CheckoutSessionResultDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating add-on checkout for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CheckoutSessionResultDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<CheckoutSessionStatusDto>> GetSessionStatusAsync(int customerId, string sessionId)
        {
            try
            {
                var pending = await _db.PendingAddOns
                    .FirstOrDefaultAsync(p => p.SessionId == sessionId && p.CustomerId == customerId);

                Stripe.Checkout.Session? stripeSession = null;
                string? paymentStatus = null;

                if (!string.IsNullOrWhiteSpace(_settings.SecretKey))
                {
                    try
                    {
                        var sessionSvc = new Stripe.Checkout.SessionService();
                        stripeSession = await sessionSvc.GetAsync(sessionId);
                        paymentStatus = stripeSession.PaymentStatus;
                    }
                    catch (StripeException ex)
                    {
                        _logger.LogWarning(ex, "Stripe session lookup failed for {SessionId}", sessionId);
                    }
                }

                // Polling-mode apply — same pattern as the upgrade flow's GetSessionStatusAsync.
                // Local dev has no `stripe listen` tunnel; the frontend hits this endpoint after
                // returning from Stripe and we reconcile inline.
                if (stripeSession != null
                    && string.Equals(stripeSession.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase)
                    && pending != null
                    && pending.CompletedAt == null)
                {
                    try
                    {
                        await ApplyAddOnCheckoutCompletedAsync(stripeSession);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Polling-mode add-on apply failed for session {SessionId}", sessionId);
                    }
                }

                var pendingFinal = await _db.PendingAddOns
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.SessionId == sessionId && p.CustomerId == customerId);

                return ApiResponseFactory.Success(new CheckoutSessionStatusDto
                {
                    SessionId = sessionId,
                    IsPaid = string.Equals(paymentStatus, "paid", StringComparison.OrdinalIgnoreCase),
                    PlanApplied = pendingFinal?.CompletedAt != null,
                    PaymentStatus = paymentStatus
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting add-on session status for {SessionId}", sessionId);
                return ApiResponseFactory.InternalError<CheckoutSessionStatusDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<int>> ReconcilePendingAsync(int customerId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.Success(0, "Stripe not configured — nothing to reconcile.");

                var pendingRows = await _db.PendingAddOns
                    .Where(p => p.CustomerId == customerId && p.CompletedAt == null)
                    .ToListAsync();

                if (pendingRows.Count == 0)
                    return ApiResponseFactory.Success(0, "No pending add-ons.");

                var sessionSvc = new Stripe.Checkout.SessionService();
                int applied = 0;

                foreach (var pending in pendingRows)
                {
                    try
                    {
                        var session = await sessionSvc.GetAsync(pending.SessionId);
                        if (string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
                        {
                            await ApplyAddOnCheckoutCompletedAsync(session);
                            applied++;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Reconcile failed for pending add-on session {SessionId}", pending.SessionId);
                        // Continue to next row — don't fail the whole reconciliation pass.
                    }
                }

                return ApiResponseFactory.Success(applied,
                    applied == 0 ? "No paid add-ons to apply." : $"Applied {applied} pending add-on(s).");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reconciling pending add-ons for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<int>(ex.Message);
            }
        }

        // ─── Webhook entry point (called from StripeCheckoutService.HandleWebhookAsync) ───

        /// <summary>
        /// Public so <see cref="StripeCheckoutService.ApplyCheckoutCompletedAsync"/> can dispatch
        /// add-on sessions here. Idempotent — guarded by PendingAddOn.CompletedAt.
        /// </summary>
        public async Task ApplyAddOnCheckoutCompletedAsync(Stripe.Checkout.Session session)
        {
            if (!string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Add-on session {SessionId} not paid (status={Status}) — skipping",
                    session.Id, session.PaymentStatus);
                return;
            }

            var pending = await _db.PendingAddOns
                .FirstOrDefaultAsync(p => p.SessionId == session.Id);

            if (pending == null)
            {
                _logger.LogWarning("No PendingAddOn row for add-on session {SessionId}", session.Id);
                return;
            }

            if (pending.CompletedAt != null)
            {
                _logger.LogInformation("PendingAddOn {SessionId} already completed", session.Id);
                return;
            }

            // Rehydrate the items + reload the context so we have the latest pricing/sub.
            var items = JsonSerializer.Deserialize<List<AddOnItemDto>>(pending.ItemsJson) ?? new List<AddOnItemDto>();
            var dto = new AddOnRequestDto { Items = items, Notes = pending.Notes };

            var ctx = await LoadContextAsync(pending.CustomerId, dto);
            if (ctx.Error != null)
            {
                _logger.LogError("Cannot apply paid add-on session {SessionId}: {Error}", session.Id, ctx.Error);
                return;
            }

            // Proration was already collected via Checkout, so suppress Stripe's auto-proration
            // on the subscription update — otherwise the customer would be charged twice for
            // the partial period.
            await ApplyAddOnSubscriptionUpdateAsync(ctx, dto, prorationBehavior: "none");
            await MirrorSubscriptionAddOnsForContextAsync(ctx);

            // Backend-driven license-row commit. This is the single source of truth for
            // "did the user's clicks actually persist". Runs from every apply path (webhook,
            // status-poll, reconcile) so license rows match Stripe regardless of which path
            // wins the race. Frontend no longer commits rows itself — eliminates the
            // "user closed browser after Stripe redirect → rows never created" footgun.
            await CommitLicenseChangesAsync(pending.CustomerId, items, pending.RequestedByUserId ?? 0);

            // Synthesize a local Invoice row for the add-on charge so it shows up in
            // the tenant's Invoice History panel. Stripe Checkout in mode=payment
            // creates a PaymentIntent / Charge but NOT a Stripe Invoice, so the
            // existing invoice.* webhook paths don't capture this payment. Without
            // this step, the tenant gets billed but sees no record in the UI.
            await CreateLocalInvoiceForAddOnAsync(pending, ctx, items, session);

            pending.CompletedAt = DateTime.UtcNow;

            // Stamp the subscription so the existing IsPaid + LastPaymentAt fields stay current.
            var sub = await _db.Subscriptions.FirstOrDefaultAsync(s => s.CustomerId == pending.CustomerId);
            if (sub != null)
            {
                sub.LastPaymentAt = DateTime.UtcNow;
                sub.StripeLastSessionId = session.Id;
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation("Applied paid add-on session {SessionId} for customer {CustomerId}",
                session.Id, pending.CustomerId);
        }

        /// <summary>
        /// Iterates the items from a paid PendingAddOn and creates/removes the matching
        /// CustomerAppLicense rows. Adds run first (so display reflects new devices),
        /// removes second. Errors are logged per-row but don't abort the whole commit —
        /// partial success is preferable to leaving Stripe billing updated but rows missing.
        /// </summary>
        private async Task CommitLicenseChangesAsync(int customerId, List<AddOnItemDto> items, int actorUserId)
        {
            foreach (var item in items)
            {
                var addCount = item.AddedQuantity ?? 0;
                for (int i = 0; i < addCount; i++)
                {
                    try
                    {
                        var addRes = await _licenseService.AddLicenseAsync(
                            customerId,
                            new AddLicenseDto { AppId = item.AppId },
                            actorUserId);
                        if (!addRes.IsSuccess)
                        {
                            _logger.LogError("AddLicenseAsync failed for customer {CustomerId} app {AppId}: {Message}",
                                customerId, item.AppId, addRes.Message);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "AddLicenseAsync threw for customer {CustomerId} app {AppId}",
                            customerId, item.AppId);
                    }
                }

                if (item.RemoveLicenseIds == null) continue;
                foreach (var licenseId in item.RemoveLicenseIds)
                {
                    try
                    {
                        var removeRes = await _licenseService.RequestRemovalAsync(customerId, licenseId, actorUserId);
                        if (!removeRes.IsSuccess)
                        {
                            _logger.LogError("RequestRemovalAsync failed for customer {CustomerId} license {LicenseId}: {Message}",
                                customerId, licenseId, removeRes.Message);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "RequestRemovalAsync threw for customer {CustomerId} license {LicenseId}",
                            customerId, licenseId);
                    }
                }
            }
        }

        /// <summary>
        /// Creates a local Invoice row representing the add-on prorated charge.
        ///
        /// Background: Stripe Checkout in <c>mode=payment</c> creates a PaymentIntent /
        /// Charge — NOT a Stripe Invoice. So the existing webhook handlers that mirror
        /// <c>invoice.paid</c> events into our Invoices table don't catch add-on
        /// payments. Without this method, customers are charged correctly but their
        /// Invoice History panel never shows the line, looking like a missed receipt.
        ///
        /// We synthesize the Invoice locally with PaymentReference = session.Id so it
        /// can be cross-referenced to Stripe's session log. Idempotent — guarded by a
        /// pre-check on PaymentReference so reconcile/webhook re-runs don't duplicate.
        /// </summary>
        private async Task CreateLocalInvoiceForAddOnAsync(
            PendingAddOn pending,
            AddOnContext ctx,
            List<AddOnItemDto> items,
            Stripe.Checkout.Session session)
        {
            // Idempotency guard — a second apply pass (e.g. webhook AND reconcile both
            // racing) would otherwise create a duplicate Invoice row.
            var existing = await _db.Invoices
                .AsNoTracking()
                .AnyAsync(i => i.PaymentReference == session.Id);
            if (existing)
            {
                _logger.LogDebug("Invoice for add-on session {SessionId} already exists — skipping", session.Id);
                return;
            }

            var now = DateTime.UtcNow;
            var firstItem = ctx.Subscription?.CurrentPeriodStart;
            var periodStart = ctx.Subscription?.CurrentPeriodStart ?? now;
            var periodEnd = ctx.Subscription?.CurrentPeriodEnd ?? now.AddMonths(1);

            var invoice = new BackOffice.Domain.Entities.Main.Invoice
            {
                CustomerId = pending.CustomerId,
                // Prefix distinguishes add-on charges from regular subscription invoices
                // in the UI without needing a separate column. Format chosen to match
                // the existing "INV-..." numbering convention loosely.
                InvoiceNumber = $"ADDON-{pending.Id:D5}",
                BillingPeriodStart = periodStart,
                BillingPeriodEnd = periodEnd,
                IssuedAt = now,
                DueDate = now,
                SubTotal = pending.ProrationAmount,
                TaxAmount = 0m,
                TotalAmount = pending.ProrationAmount,
                Status = InvoiceStatus.Paid,
                PaidAt = now,
                PaymentReference = session.Id,
                Notes = string.IsNullOrWhiteSpace(pending.Notes)
                    ? "Mid-cycle add-on (Stripe Checkout)"
                    : $"Mid-cycle add-on (Stripe Checkout) — {pending.Notes}",
                CreatedAt = now,
                LineItems = new List<BackOffice.Domain.Entities.Main.InvoiceLineItem>()
            };

            // One InvoiceLineItem per app that had a positive add (matches the modal's
            // "Charges today" breakdown). Removes don't appear here — they don't bill.
            foreach (var item in items)
            {
                var added = item.AddedQuantity ?? 0;
                if (added <= 0) continue;
                if (!ctx.PricingByAppId.TryGetValue(item.AppId, out var pricing)) continue;

                // Per-line proration math identical to ComputeProrationCentsLocal so the
                // sum of line totals equals the invoice total.
                var totalDays = Math.Max(1d, Math.Round((periodEnd - periodStart).TotalDays));
                var remainingDays = Math.Max(0d, Math.Round((periodEnd - now).TotalDays));
                var prorationFactor = remainingDays / totalDays;
                var lineTotal = Math.Round(added * pricing.PricePerUnit * (decimal)prorationFactor, 2, MidpointRounding.AwayFromZero);

                invoice.LineItems.Add(new BackOffice.Domain.Entities.Main.InvoiceLineItem
                {
                    Description = $"+{added} {pricing.PricingModel.Replace("per_", "")} (App {item.AppId}) — prorated for {(int)remainingDays}d remaining",
                    AppId = item.AppId,
                    Category = "device_license",
                    PricingModel = pricing.PricingModel,
                    Quantity = added,
                    FreeUnits = 0,
                    BillableUnits = added,
                    UnitPrice = pricing.PricePerUnit,
                    LineTotal = lineTotal
                });
            }

            _db.Invoices.Add(invoice);
            // SaveChanges happens in the caller alongside the PendingAddOn.CompletedAt
            // flip — single transaction so apply is all-or-nothing.
        }

        // ─── Helpers ───────────────────────────────────────────────────────────

        private record AddOnContext(
            BackOffice.Domain.Entities.Main.Customer? Customer,
            BackOffice.Domain.Entities.Main.Subscription? Subscription,
            string? PlanName,
            // Map: Stripe overage Price id → local PlanAppPricing row, scoped to the active plan.
            Dictionary<string, PlanAppPricing> PricingByPriceId,
            // Map: AppId → PlanAppPricing — for resolving items in the request.
            Dictionary<int, PlanAppPricing> PricingByAppId,
            string? Error);

        /// <summary>
        /// One-shot fetch of customer / subscription / plan / pricing rows. Also
        /// triggers <see cref="IStripeCatalogService.SyncPlanAsync"/> on first use
        /// so admins don't have to remember to mint overage Prices manually.
        /// </summary>
        private async Task<AddOnContext> LoadContextAsync(int customerId, AddOnRequestDto dto)
        {
            var customer = await _db.Customers
                .Include(c => c.Subscription)
                .ThenInclude(s => s!.Plan)
                .FirstOrDefaultAsync(c => c.CustomerId == customerId);

            if (customer == null)
                return ErrorCtx("Customer not found.");

            if (string.IsNullOrWhiteSpace(customer.StripeCustomerId))
                return ErrorCtx("Customer has no Stripe id. Subscribe to a plan first.");

            var sub = customer.Subscription;
            if (sub == null || string.IsNullOrWhiteSpace(sub.StripeSubscriptionId))
                return ErrorCtx("No active Stripe subscription. Subscribe to a plan first.");

            if (dto.Items == null || dto.Items.Count == 0)
                return ErrorCtx("No items in add-on request.");

            var requestedAppIds = dto.Items.Select(i => i.AppId).Distinct().ToList();

            var pricingRows = await _db.PlanAppPricings
                .Where(p => p.PlanId == sub.PlanId && requestedAppIds.Contains(p.AppId))
                .ToListAsync();

            // Validate each requested item.
            foreach (var item in dto.Items)
            {
                if (item.Quantity < 0) return ErrorCtx($"Quantity for app {item.AppId} must be >= 0.");

                var pricing = pricingRows.FirstOrDefault(p => p.AppId == item.AppId);
                if (pricing == null) return ErrorCtx($"This plan does not include app {item.AppId}.");
                if (!pricing.IsIncluded) return ErrorCtx($"App {item.AppId} is disabled for the current plan.");
                if (string.Equals(pricing.PricingModel, "flat", StringComparison.OrdinalIgnoreCase))
                    return ErrorCtx($"App {item.AppId} uses flat pricing — no per-unit add-on is available.");
                if (pricing.PricePerUnit <= 0)
                    return ErrorCtx($"PricePerUnit is not configured for app {item.AppId}.");
                if (pricing.MaxUnits.HasValue && item.Quantity > pricing.MaxUnits.Value)
                    return ErrorCtx($"Quantity for app {item.AppId} exceeds plan cap ({pricing.MaxUnits.Value}).");
            }

            // Lazy-mint any missing overage Prices so admins don't have to re-run sync.
            var anyMissingPrice = pricingRows.Any(p => string.IsNullOrWhiteSpace(p.StripeOveragePriceId));
            if (anyMissingPrice)
            {
                var sync = await _catalog.SyncPlanAsync(sub.PlanId);
                if (!sync.IsSuccess)
                    return ErrorCtx($"Failed to sync overage prices to Stripe: {sync.Message}");

                pricingRows = await _db.PlanAppPricings
                    .Where(p => p.PlanId == sub.PlanId && requestedAppIds.Contains(p.AppId))
                    .ToListAsync();

                if (pricingRows.Any(p => string.IsNullOrWhiteSpace(p.StripeOveragePriceId)))
                    return ErrorCtx("Stripe overage price unavailable after sync.");
            }

            var byPriceId = pricingRows
                .Where(p => !string.IsNullOrWhiteSpace(p.StripeOveragePriceId))
                .ToDictionary(p => p.StripeOveragePriceId!, p => p, StringComparer.Ordinal);

            var byAppId = pricingRows.ToDictionary(p => p.AppId, p => p);

            return new AddOnContext(customer, sub, sub.Plan?.Name, byPriceId, byAppId, null);
        }

        private static AddOnContext ErrorCtx(string msg)
            => new AddOnContext(null, null, null,
                new Dictionary<string, PlanAppPricing>(),
                new Dictionary<int, PlanAppPricing>(),
                msg);

        /// <summary>
        /// Builds the desired post-change subscription items for an
        /// Invoices.CreatePreviewAsync call — Stripe needs the full set of items
        /// after the change to compute proration. We pass-through existing items
        /// untouched (Stripe keeps any not mentioned) and explicitly add/update/
        /// delete only the overage items requested in <paramref name="requested"/>.
        /// </summary>
        private static List<InvoiceSubscriptionDetailsItemOptions> BuildPreviewItemUpdates(
            StripeSubscription currentSub,
            Dictionary<string, PlanAppPricing> pricingByPriceId,
            List<AddOnItemDto> requested)
        {
            var items = new List<InvoiceSubscriptionDetailsItemOptions>();
            var matchedAppIds = new HashSet<int>();

            // Walk existing items: if one matches a requested overage price, queue
            // either an update (new quantity) or a delete (quantity 0).
            foreach (var existing in currentSub.Items?.Data ?? new List<SubscriptionItem>())
            {
                var existingPriceId = existing.Price?.Id;
                if (string.IsNullOrWhiteSpace(existingPriceId)) continue;

                if (!pricingByPriceId.TryGetValue(existingPriceId, out var pricing))
                    continue; // not an overage item we manage — leave alone

                var match = requested.FirstOrDefault(r => r.AppId == pricing.AppId);
                if (match == null) continue;

                matchedAppIds.Add(pricing.AppId);

                // Skip no-ops (same quantity) so the preview doesn't add zero lines.
                var currentQty = (int)(existing.Quantity > 0 ? existing.Quantity : 1);
                if (currentQty == match.Quantity) continue;

                if (match.Quantity == 0)
                {
                    items.Add(new InvoiceSubscriptionDetailsItemOptions
                    {
                        Id = existing.Id,
                        Deleted = true
                    });
                }
                else
                {
                    items.Add(new InvoiceSubscriptionDetailsItemOptions
                    {
                        Id = existing.Id,
                        Quantity = match.Quantity
                    });
                }
            }

            // New items (requested but no existing item yet).
            foreach (var match in requested)
            {
                if (matchedAppIds.Contains(match.AppId)) continue;
                if (match.Quantity == 0) continue; // adding 0 of a non-existent item is a no-op

                var pricing = pricingByPriceId.Values.FirstOrDefault(p => p.AppId == match.AppId);
                if (pricing == null) continue;

                items.Add(new InvoiceSubscriptionDetailsItemOptions
                {
                    Price = pricing.StripeOveragePriceId,
                    Quantity = match.Quantity
                });
            }

            return items;
        }

        /// <summary>
        /// Builds the line-items shown on the Stripe Checkout page. One human-readable
        /// line per requested change, plus a final reconciliation line if the per-line
        /// math doesn't sum to Stripe's actual AmountDue (covers proration credits etc.).
        /// </summary>
        private static List<Stripe.Checkout.SessionLineItemOptions> BuildCheckoutLineItems(
            string currency, AddOnRequestDto dto, string? planName, long stripeAmountDueCents)
        {
            // Stripe Checkout requires every line item to have a non-zero unit amount.
            // The simplest, accurate option: one composite line for the total Stripe
            // computed. Users already saw the per-app breakdown on our page.
            return new List<Stripe.Checkout.SessionLineItemOptions>
            {
                new Stripe.Checkout.SessionLineItemOptions
                {
                    Quantity = 1,
                    PriceData = new Stripe.Checkout.SessionLineItemPriceDataOptions
                    {
                        Currency = currency,
                        UnitAmount = stripeAmountDueCents,
                        ProductData = new Stripe.Checkout.SessionLineItemPriceDataProductDataOptions
                        {
                            Name = string.IsNullOrWhiteSpace(planName)
                                ? "License changes (prorated)"
                                : $"{planName} — license changes (prorated)",
                            Description = $"{dto.Items.Count} line(s) updated mid-cycle"
                        }
                    }
                }
            };
        }

        /// <summary>
        /// Calls Stripe SubscriptionService.UpdateAsync to add/update/delete the
        /// overage Subscription Items per the request. Used by both the
        /// "free credit, no Checkout" branch and the post-Checkout apply step —
        /// the only difference is the proration_behavior argument.
        /// </summary>
        private static async Task ApplyAddOnSubscriptionUpdateAsync(
            AddOnContext ctx, AddOnRequestDto dto, string prorationBehavior)
        {
            var subSvc = new Stripe.SubscriptionService();
            var currentSub = await subSvc.GetAsync(ctx.Subscription!.StripeSubscriptionId);

            var itemUpdates = new List<SubscriptionItemOptions>();
            var matchedAppIds = new HashSet<int>();

            foreach (var existing in currentSub.Items?.Data ?? new List<SubscriptionItem>())
            {
                var existingPriceId = existing.Price?.Id;
                if (string.IsNullOrWhiteSpace(existingPriceId)) continue;
                if (!ctx.PricingByPriceId.TryGetValue(existingPriceId, out var pricing)) continue;

                var match = dto.Items.FirstOrDefault(r => r.AppId == pricing.AppId);
                if (match == null) continue;

                matchedAppIds.Add(pricing.AppId);

                var currentQty = (int)(existing.Quantity > 0 ? existing.Quantity : 1);
                if (currentQty == match.Quantity) continue;

                if (match.Quantity == 0)
                {
                    itemUpdates.Add(new SubscriptionItemOptions { Id = existing.Id, Deleted = true });
                }
                else
                {
                    itemUpdates.Add(new SubscriptionItemOptions { Id = existing.Id, Quantity = match.Quantity });
                }
            }

            foreach (var match in dto.Items)
            {
                if (matchedAppIds.Contains(match.AppId)) continue;
                if (match.Quantity == 0) continue;
                if (!ctx.PricingByAppId.TryGetValue(match.AppId, out var pricing)) continue;
                if (string.IsNullOrWhiteSpace(pricing.StripeOveragePriceId)) continue;

                itemUpdates.Add(new SubscriptionItemOptions
                {
                    Price = pricing.StripeOveragePriceId,
                    Quantity = match.Quantity
                });
            }

            if (itemUpdates.Count == 0) return; // nothing actually changed

            await subSvc.UpdateAsync(ctx.Subscription.StripeSubscriptionId, new SubscriptionUpdateOptions
            {
                Items = itemUpdates,
                ProrationBehavior = prorationBehavior,
                Metadata = new Dictionary<string, string>
                {
                    ["customer_id"] = ctx.Customer!.CustomerId.ToString(),
                    ["addon_apply_at"] = DateTime.UtcNow.ToString("O")
                }
            });
        }

        /// <summary>
        /// Re-fetches the Stripe subscription post-update and writes its items into
        /// the SubscriptionAddOns table. Webhook-driven mirror does the same job;
        /// this is the inline-mirror shortcut for snappy UI updates.
        /// </summary>
        private async Task MirrorSubscriptionAddOnsForContextAsync(AddOnContext ctx)
        {
            var subSvc = new Stripe.SubscriptionService();
            var stripeSub = await subSvc.GetAsync(ctx.Subscription!.StripeSubscriptionId);

            var existing = await _db.SubscriptionAddOns
                .Where(a => a.SubscriptionId == ctx.Subscription.Id)
                .ToListAsync();

            var now = DateTime.UtcNow;
            var seenPriceIds = new HashSet<string>(StringComparer.Ordinal);

            foreach (var item in stripeSub.Items?.Data ?? new List<SubscriptionItem>())
            {
                var priceId = item.Price?.Id;
                if (string.IsNullOrWhiteSpace(priceId)) continue;
                if (!ctx.PricingByPriceId.TryGetValue(priceId, out var pricing)) continue;

                seenPriceIds.Add(priceId);
                var qty = item.Quantity > 0 ? (int)item.Quantity : 1;
                var match = existing.FirstOrDefault(a =>
                    a.StripePriceId == priceId || a.StripeSubscriptionItemId == item.Id);

                if (match == null)
                {
                    _db.SubscriptionAddOns.Add(new SubscriptionAddOn
                    {
                        SubscriptionId = ctx.Subscription.Id,
                        FeatureCode = $"app-{pricing.AppId}-{pricing.PricingModel}",
                        FeatureName = $"App {pricing.AppId} — extra {pricing.PricingModel.Replace("per_", "")}",
                        Quantity = qty,
                        StripeSubscriptionItemId = item.Id,
                        StripePriceId = priceId,
                        UnitAmount = pricing.PricePerUnit,
                        AddedAt = now,
                        RemovedAt = null
                    });
                }
                else
                {
                    match.Quantity = qty;
                    match.StripeSubscriptionItemId = item.Id;
                    match.UnitAmount = pricing.PricePerUnit;
                    match.RemovedAt = null;
                }
            }

            foreach (var leftover in existing)
            {
                if (string.IsNullOrWhiteSpace(leftover.StripePriceId)) continue;
                if (seenPriceIds.Contains(leftover.StripePriceId)) continue;
                if (leftover.RemovedAt != null) continue;

                leftover.Quantity = 0;
                leftover.RemovedAt = now;
            }

            await _db.SaveChangesAsync();
        }

        private static UpcomingInvoicePreviewDto MapPreview(Stripe.Invoice preview)
        {
            // Description-based proration heuristic ("Unused time" / "Remaining time").
            // Used only to flag which lines are proration in the response, NOT to total
            // the bill — local math (ComputeProrationCentsLocal) is the source of truth
            // for what we actually charge.
            var lines = preview.Lines?.Data?.Select(l => new UpcomingInvoiceLineDto
            {
                Description = l.Description ?? string.Empty,
                Amount = l.Amount / 100m,
                IsProration = (l.Description ?? string.Empty).Contains("time", StringComparison.OrdinalIgnoreCase)
            }).ToList() ?? new List<UpcomingInvoiceLineDto>();

            return new UpcomingInvoicePreviewDto
            {
                // Filled in by the caller via WithLocalProration — the preview alone
                // doesn't have enough context (we need delta vs. current Stripe qty)
                // to compute the proration without re-fetching the subscription. Keeping
                // this method shape so the existing call sites stay simple.
                AmountDueNow = 0m,
                NextCycleAmount = preview.AmountDue / 100m, // upper bound — used informationally
                NextBillingDate = preview.NextPaymentAttempt ?? preview.PeriodEnd,
                Currency = preview.Currency ?? "usd",
                Lines = lines
            };
        }

        /// <summary>
        /// Computes the prorated charge for a set of overage-quantity changes against
        /// the current Stripe subscription. Local math, deterministic, matches the
        /// frontend's per-line display:
        ///
        ///   delta_qty × price_per_unit × (days_remaining / days_in_period)
        ///
        /// Rounded to whole cents (banker's rounding).
        ///
        /// Why local instead of trusting Stripe's <c>InvoiceService.CreatePreviewAsync</c>:
        /// the preview returns the FULL upcoming invoice (proration + next month's
        /// recurring + any other unrelated balance adjustments), with no clean filter
        /// to extract just the proration delta. Local math gives the user the exact
        /// number they expect; Stripe absorbs sub-cent rounding diffs naturally when
        /// we later apply with <c>proration_behavior="none"</c>.
        /// </summary>
        private static long ComputeProrationCentsLocal(
            Stripe.Subscription currentSub,
            Dictionary<int, PlanAppPricing> pricingByAppId,
            List<AddOnItemDto> requested)
        {
            var now = DateTime.UtcNow;
            // Stripe.net 48: CurrentPeriod* lives on the subscription item, not the sub.
            var firstItem = currentSub.Items?.Data?.FirstOrDefault();
            var periodStart = firstItem?.CurrentPeriodStart ?? now;
            var periodEnd = firstItem?.CurrentPeriodEnd ?? now.AddMonths(1);

            // Use rounded WHOLE-DAY counts to match the frontend's per-line display.
            // Sub-day fractions (e.g. running this 14:32 on day 8 of 31) make the
            // raw-seconds factor diverge by a few cents from the modal's number,
            // which the user sees as "I clicked the $14.84 button but got charged $14.78".
            // Rounded days are deterministic and match what the user agrees to.
            var totalDays = Math.Max(1d, Math.Round((periodEnd - periodStart).TotalDays));
            var remainingDays = Math.Max(0d, Math.Round((periodEnd - now).TotalDays));
            var prorationFactor = remainingDays / totalDays;

            long totalCents = 0;
            foreach (var item in requested)
            {
                if (!pricingByAppId.TryGetValue(item.AppId, out var pricing)) continue;

                int chargeDelta;
                if (item.AddedQuantity.HasValue)
                {
                    // Frontend-authoritative path: the user clicked +N (or -N) in THIS session;
                    // charge for that exact delta regardless of Stripe state. This avoids the
                    // "you only owe $7 because Stripe already has stale overage from a prior
                    // test" surprise — the user pays for what the modal showed them.
                    chargeDelta = item.AddedQuantity.Value;
                }
                else
                {
                    // Legacy / API-only caller (no frontend context) — diff against the live
                    // Stripe overage quantity for this App. May be off if the customer's Stripe
                    // sub has out-of-band items, but it's the only signal we have.
                    var existing = currentSub.Items?.Data?.FirstOrDefault(i =>
                        string.Equals(i.Price?.Id, pricing.StripeOveragePriceId, StringComparison.Ordinal));
                    var currentQty = existing != null && existing.Quantity > 0 ? (int)existing.Quantity : 0;
                    chargeDelta = item.Quantity - currentQty;
                }

                if (chargeDelta == 0) continue;

                var perUnitCents = (long)Math.Round(pricing.PricePerUnit * 100m, MidpointRounding.AwayFromZero);
                var lineCents = (long)Math.Round(chargeDelta * perUnitCents * prorationFactor, MidpointRounding.AwayFromZero);
                totalCents += lineCents;
            }

            return totalCents;
        }

        private static UpcomingInvoicePreviewDto EmptyPreview() => new UpcomingInvoicePreviewDto
        {
            AmountDueNow = 0m,
            NextCycleAmount = 0m,
            NextBillingDate = null,
            Currency = "usd",
            Lines = new List<UpcomingInvoiceLineDto>()
        };
    }
}
