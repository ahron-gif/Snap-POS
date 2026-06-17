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
// Stripe.Checkout.* is referenced via fully-qualified names below to avoid
// colliding with BackOffice.Persistence.Services.Main.SessionService.
// Alias Stripe types that collide with BackOffice.Domain.Entities.Main namesakes.
using StripeSubscription = Stripe.Subscription;
using StripeInvoice = Stripe.Invoice;
using StripeInvoiceLineItem = Stripe.InvoiceLineItem;

namespace BackOffice.Persistence.Services.Main
{
    public class StripeCheckoutService : IStripeCheckoutService
    {
        private readonly MainDBContext _db;
        private readonly ISubscriptionService _subscriptionService;
        private readonly IStripeCatalogService _catalogService;
        private readonly IAddOnService _addOnService;
        private readonly ICustomerCreditService _creditService;
        private readonly StripeSettings _settings;
        private readonly ILogger<StripeCheckoutService> _logger;

        public StripeCheckoutService(
            MainDBContext db,
            ISubscriptionService subscriptionService,
            IStripeCatalogService catalogService,
            IAddOnService addOnService,
            ICustomerCreditService creditService,
            IOptions<StripeSettings> settings,
            ILogger<StripeCheckoutService> logger)
        {
            _db = db;
            _subscriptionService = subscriptionService;
            _catalogService = catalogService;
            _addOnService = addOnService;
            _creditService = creditService;
            _settings = settings.Value;
            _logger = logger;

            // Stripe SDK reads its key from a static. Setting it on each construction is cheap and idempotent.
            if (!string.IsNullOrWhiteSpace(_settings.SecretKey))
                StripeConfiguration.ApiKey = _settings.SecretKey;
        }

        /// <summary>
        /// Guarantee a Stripe Customer exists for this BackOffice tenant. See
        /// <see cref="IStripeCheckoutService.EnsureStripeCustomerAsync"/> for the contract.
        /// Race-safe in the rare case of two concurrent first-pay clicks because step 2
        /// catches an orphan created by the loser of the race, instead of creating a
        /// second cus_… and overwriting the link.
        /// </summary>
        public async Task<ApiResponse<EnsureStripeCustomerResultDto>> EnsureStripeCustomerAsync(int customerId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<EnsureStripeCustomerResultDto>("Stripe is not configured.");

                var customer = await _db.Customers
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<EnsureStripeCustomerResultDto>("Customer not found.");

                // Step 1: already linked.
                if (!string.IsNullOrWhiteSpace(customer.StripeCustomerId))
                {
                    return ApiResponseFactory.Success(new EnsureStripeCustomerResultDto
                    {
                        StripeCustomerId = customer.StripeCustomerId,
                        Source = "already_linked"
                    });
                }

                var stripeCustomerSvc = new Stripe.CustomerService();

                // Step 2: look for an orphan. A previous lazy-create may have created
                // a Stripe Customer with our metadata["customer_id"] but failed to save
                // the DB write (race condition, transient SQL failure, etc.). Re-linking
                // the orphan is preferable to creating a second one.
                try
                {
                    var search = await stripeCustomerSvc.SearchAsync(new Stripe.CustomerSearchOptions
                    {
                        Query = $"metadata['customer_id']:'{customerId}'",
                        Limit = 1
                    });
                    var orphan = search?.Data?.FirstOrDefault();
                    if (orphan != null)
                    {
                        customer.StripeCustomerId = orphan.Id;
                        await _db.SaveChangesAsync();
                        _logger.LogInformation(
                            "Re-linked orphan Stripe Customer {StripeCustomerId} for tenant {CustomerId}",
                            orphan.Id, customerId);
                        return ApiResponseFactory.Success(new EnsureStripeCustomerResultDto
                        {
                            StripeCustomerId = orphan.Id,
                            Source = "found_orphan"
                        });
                    }
                }
                catch (StripeException sex)
                {
                    // Stripe Search requires a paid plan / specific permissions on some
                    // accounts. If it isn't available, we fall through to plain create —
                    // matches the old behavior, no regression.
                    _logger.LogWarning(sex,
                        "Stripe customer search unavailable; falling through to create for tenant {CustomerId}",
                        customerId);
                }

                // Step 3: create a new Stripe Customer.
                var stripeCustomer = await stripeCustomerSvc.CreateAsync(new CustomerCreateOptions
                {
                    Name = customer.CustomerName,
                    Email = customer.ContactEmail ?? customer.Email,
                    Metadata = new Dictionary<string, string>
                    {
                        ["customer_id"] = customer.CustomerId.ToString()
                    }
                });
                customer.StripeCustomerId = stripeCustomer.Id;
                await _db.SaveChangesAsync();

                _logger.LogInformation(
                    "Created Stripe Customer {StripeCustomerId} for tenant {CustomerId}",
                    stripeCustomer.Id, customerId);

                return ApiResponseFactory.Success(new EnsureStripeCustomerResultDto
                {
                    StripeCustomerId = stripeCustomer.Id,
                    Source = "created"
                });
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex,
                    "Stripe error ensuring customer link for tenant {CustomerId}",
                    customerId);
                return ApiResponseFactory.InternalError<EnsureStripeCustomerResultDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error ensuring Stripe customer link for tenant {CustomerId}",
                    customerId);
                return ApiResponseFactory.InternalError<EnsureStripeCustomerResultDto>(ex.Message);
            }
        }

        /// <summary>
        /// Lazy plan sync: makes sure a Plan has a Stripe Price before we try to use it.
        /// If StripeMonthlyPriceId is missing, calls the catalog service to create the
        /// Stripe Product + Price now, then reloads the plan from the DB. This means
        /// callers don't need to remember to run /api/Stripe/Catalog/SyncAll first.
        /// </summary>
        private async Task<BackOffice.Domain.Entities.Main.Plan?> EnsurePlanSyncedAsync(int planId)
        {
            var plan = await _db.Plans.FindAsync(planId);
            if (plan == null) return null;
            if (!string.IsNullOrWhiteSpace(plan.StripeMonthlyPriceId)) return plan;

            _logger.LogInformation("Plan {PlanId} not synced to Stripe — syncing now", planId);
            var syncResult = await _catalogService.SyncPlanAsync(planId);
            if (!syncResult.IsSuccess)
            {
                _logger.LogError("Auto-sync failed for plan {PlanId}: {Message}", planId, syncResult.Message);
                return plan; // return as-is; the caller will see the missing price and error out
            }

            // Refresh from DB so we get the new Stripe IDs.
            await _db.Entry(plan).ReloadAsync();
            return plan;
        }

        public async Task<ApiResponse<CheckoutSessionResultDto>> CreateUpgradeSessionAsync(
            int customerId,
            int requestedByUserId,
            CreateUpgradeSessionDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<CheckoutSessionResultDto>("Stripe is not configured.");

                var customer = await _db.Customers
                    .Include(c => c.Subscription).ThenInclude(s => s!.Plan)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<CheckoutSessionResultDto>("Customer not found.");

                var newPlan = await _db.Plans.FindAsync(dto.NewPlanId);
                if (newPlan == null || !newPlan.IsActive)
                    return ApiResponseFactory.NotFound<CheckoutSessionResultDto>("Plan not found or inactive.");

                if (newPlan.Price <= 0)
                    return ApiResponseFactory.BadRequest<CheckoutSessionResultDto>("Plan has no price configured.");

                // Lazy-create a Stripe Customer the first time this tenant pays.
                if (string.IsNullOrWhiteSpace(customer.StripeCustomerId))
                {
                    var stripeCustomerSvc = new Stripe.CustomerService();
                    var stripeCustomer = await stripeCustomerSvc.CreateAsync(new CustomerCreateOptions
                    {
                        Name = customer.CustomerName,
                        Email = customer.ContactEmail ?? customer.Email,
                        Metadata = new Dictionary<string, string>
                        {
                            ["customer_id"] = customer.CustomerId.ToString()
                        }
                    });
                    customer.StripeCustomerId = stripeCustomer.Id;
                }

                var frontendBase = (_settings.FrontendBaseUrl ?? "").TrimEnd('/');
                var successUrl = $"{frontendBase}/licenses-billing?upgrade=success&session_id={{CHECKOUT_SESSION_ID}}";
                var cancelUrl = $"{frontendBase}/licenses-billing?upgrade=canceled";

                var sessionOptions = new Stripe.Checkout.SessionCreateOptions
                {
                    Mode = "payment",
                    Customer = customer.StripeCustomerId,
                    PaymentMethodTypes = new List<string> { "card" },
                    LineItems = new List<Stripe.Checkout.SessionLineItemOptions>
                    {
                        new Stripe.Checkout.SessionLineItemOptions
                        {
                            Quantity = 1,
                            PriceData = new Stripe.Checkout.SessionLineItemPriceDataOptions
                            {
                                Currency = string.IsNullOrWhiteSpace(_settings.Currency) ? "usd" : _settings.Currency,
                                UnitAmount = (long)(newPlan.Price * 100m), // Stripe uses smallest currency unit (cents)
                                ProductData = new Stripe.Checkout.SessionLineItemPriceDataProductDataOptions
                                {
                                    Name = $"{newPlan.Name} plan",
                                    Description = newPlan.Description
                                }
                            }
                        }
                    },
                    SuccessUrl = successUrl,
                    CancelUrl = cancelUrl,
                    Metadata = new Dictionary<string, string>
                    {
                        ["customer_id"] = customer.CustomerId.ToString(),
                        ["new_plan_id"] = newPlan.Id.ToString(),
                        ["requested_by_user_id"] = requestedByUserId.ToString()
                    }
                };

                var sessionSvc = new Stripe.Checkout.SessionService();
                var session = await sessionSvc.CreateAsync(sessionOptions);

                _db.PendingUpgrades.Add(new PendingUpgrade
                {
                    SessionId = session.Id,
                    CustomerId = customer.CustomerId,
                    NewPlanId = newPlan.Id,
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
                _logger.LogError(sex, "Stripe error creating checkout session for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CheckoutSessionResultDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating checkout session for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CheckoutSessionResultDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<CheckoutSessionStatusDto>> GetSessionStatusAsync(
            int customerId,
            string sessionId)
        {
            try
            {
                // Tracked, scoped to the calling tenant (a tenant cannot read another's session).
                var pending = await _db.PendingUpgrades
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

                // Polling-mode apply: if Stripe confirms payment and we haven't applied yet,
                // run the same plan-change logic the webhook would. Idempotent — a second
                // poll (or a late webhook) will see CompletedAt set and exit early.
                // This removes the need to run `stripe listen` for local dev: the frontend
                // hits this endpoint after returning from Stripe, and we reconcile inline.
                if (stripeSession != null
                    && string.Equals(stripeSession.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase)
                    && pending != null
                    && pending.CompletedAt == null)
                {
                    try
                    {
                        await ApplyCheckoutCompletedAsync(stripeSession);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Polling-mode apply failed for session {SessionId}", sessionId);
                        // Continue and return current state — don't fail the status call.
                    }
                }

                // Re-read latest state after potential apply.
                var sub = await _db.Subscriptions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);
                var pendingFinal = await _db.PendingUpgrades
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.SessionId == sessionId && p.CustomerId == customerId);

                var isPaid = sub?.IsPaid == true && sub.StripeLastSessionId == sessionId;
                var planApplied = pendingFinal?.CompletedAt != null;

                return ApiResponseFactory.Success(new CheckoutSessionStatusDto
                {
                    SessionId = sessionId,
                    IsPaid = isPaid,
                    PlanApplied = planApplied,
                    PaymentStatus = paymentStatus
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting session status for {SessionId}", sessionId);
                return ApiResponseFactory.InternalError<CheckoutSessionStatusDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<CheckoutSessionResultDto>> CreateSubscribeSessionAsync(
            int customerId,
            int requestedByUserId,
            CreateSubscribeSessionDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<CheckoutSessionResultDto>("Stripe is not configured.");

                var customer = await _db.Customers
                    .Include(c => c.Subscription)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<CheckoutSessionResultDto>("Customer not found.");

                var plan = await EnsurePlanSyncedAsync(dto.PlanId);
                if (plan == null || !plan.IsActive)
                    return ApiResponseFactory.NotFound<CheckoutSessionResultDto>("Plan not found or inactive.");

                if (string.IsNullOrWhiteSpace(plan.StripeMonthlyPriceId))
                    return ApiResponseFactory.BadRequest<CheckoutSessionResultDto>(
                        "Plan auto-sync to Stripe failed. Check API logs for details.");

                // Lazy-create Stripe Customer if needed.
                if (string.IsNullOrWhiteSpace(customer.StripeCustomerId))
                {
                    var stripeCustomerSvc = new Stripe.CustomerService();
                    var stripeCustomer = await stripeCustomerSvc.CreateAsync(new CustomerCreateOptions
                    {
                        Name = customer.CustomerName,
                        Email = customer.ContactEmail ?? customer.Email,
                        Metadata = new Dictionary<string, string>
                        {
                            ["customer_id"] = customer.CustomerId.ToString()
                        }
                    });
                    customer.StripeCustomerId = stripeCustomer.Id;
                }

                var frontendBase = (_settings.FrontendBaseUrl ?? "").TrimEnd('/');
                var successUrl = $"{frontendBase}/licenses-billing?subscribe=success&session_id={{CHECKOUT_SESSION_ID}}";
                var cancelUrl = $"{frontendBase}/licenses-billing?subscribe=canceled";

                var sessionOptions = new Stripe.Checkout.SessionCreateOptions
                {
                    Mode = "subscription",
                    Customer = customer.StripeCustomerId,
                    PaymentMethodTypes = new List<string> { "card" },
                    LineItems = new List<Stripe.Checkout.SessionLineItemOptions>
                    {
                        new Stripe.Checkout.SessionLineItemOptions
                        {
                            Price = plan.StripeMonthlyPriceId,
                            Quantity = 1
                        }
                    },
                    SuccessUrl = successUrl,
                    CancelUrl = cancelUrl,
                    SubscriptionData = new Stripe.Checkout.SessionSubscriptionDataOptions
                    {
                        Metadata = new Dictionary<string, string>
                        {
                            ["customer_id"] = customer.CustomerId.ToString(),
                            ["plan_id"] = plan.Id.ToString(),
                            ["requested_by_user_id"] = requestedByUserId.ToString()
                        }
                    },
                    Metadata = new Dictionary<string, string>
                    {
                        ["customer_id"] = customer.CustomerId.ToString(),
                        ["plan_id"] = plan.Id.ToString(),
                        ["flow"] = "subscribe"
                    }
                };

                var sessionSvc = new Stripe.Checkout.SessionService();
                var session = await sessionSvc.CreateAsync(sessionOptions);

                // Store as PendingUpgrade so the existing reconcile-on-load loop catches
                // any Stripe-redirect mishaps for this signup too.
                _db.PendingUpgrades.Add(new PendingUpgrade
                {
                    SessionId = session.Id,
                    CustomerId = customer.CustomerId,
                    NewPlanId = plan.Id,
                    Notes = dto.Notes ?? "Stripe subscribe (mode=subscription)",
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
                _logger.LogError(sex, "Stripe error creating subscribe session for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CheckoutSessionResultDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating subscribe session for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CheckoutSessionResultDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<int>> ReconcilePendingAsync(int customerId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.Success(0, "Stripe not configured.");

                var pendingRows = await _db.PendingUpgrades
                    .Where(p => p.CustomerId == customerId && p.CompletedAt == null)
                    .OrderBy(p => p.CreatedAt)
                    .ToListAsync();

                if (pendingRows.Count == 0)
                    return ApiResponseFactory.Success(0);

                var sessionSvc = new Stripe.Checkout.SessionService();
                int applied = 0;

                foreach (var pending in pendingRows)
                {
                    try
                    {
                        var session = await sessionSvc.GetAsync(pending.SessionId);
                        if (string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
                        {
                            await ApplyCheckoutCompletedAsync(session);
                            applied++;
                        }
                        // If unpaid/expired/canceled we leave the row alone — it stays as a record.
                    }
                    catch (StripeException ex)
                    {
                        _logger.LogWarning(ex, "Reconcile: Stripe lookup failed for session {SessionId}", pending.SessionId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Reconcile: apply failed for session {SessionId}", pending.SessionId);
                    }
                }

                return ApiResponseFactory.Success(applied);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reconciling pending upgrades for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<int>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> HandleWebhookAsync(string payload, string signatureHeader)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.WebhookSecret))
                    return ApiResponseFactory.InternalError<bool>("Stripe webhook secret is not configured.");

                Event stripeEvent;
                try
                {
                    stripeEvent = EventUtility.ConstructEvent(payload, signatureHeader, _settings.WebhookSecret);
                }
                catch (StripeException ex)
                {
                    _logger.LogWarning(ex, "Stripe webhook signature verification failed");
                    return ApiResponseFactory.BadRequest<bool>("Invalid signature.");
                }

                // Idempotency: dedupe by Stripe event id.
                var alreadySeen = await _db.StripeWebhookEvents
                    .AnyAsync(e => e.EventId == stripeEvent.Id);
                if (alreadySeen)
                {
                    _logger.LogInformation("Stripe event {EventId} already processed, skipping", stripeEvent.Id);
                    return ApiResponseFactory.Success(true, "Already processed.");
                }

                var record = new StripeWebhookEvent
                {
                    EventId = stripeEvent.Id,
                    EventType = stripeEvent.Type,
                    ReceivedAt = DateTime.UtcNow
                };
                _db.StripeWebhookEvents.Add(record);
                await _db.SaveChangesAsync();

                try
                {
                    switch (stripeEvent.Type)
                    {
                        case "checkout.session.completed":
                            if (stripeEvent.Data.Object is Stripe.Checkout.Session session)
                                await ApplyCheckoutCompletedAsync(session);
                            break;

                        // Phase 2: subscription lifecycle events.
                        case "customer.subscription.created":
                        case "customer.subscription.updated":
                            if (stripeEvent.Data.Object is StripeSubscription sub)
                            {
                                await MirrorSubscriptionStateAsync(sub);
                                await MirrorSubscriptionAddOnsAsync(sub);
                            }
                            break;

                        case "customer.subscription.deleted":
                            if (stripeEvent.Data.Object is StripeSubscription deletedSub)
                                await MirrorSubscriptionDeletedAsync(deletedSub);
                            break;

                        case "invoice.paid":
                            if (stripeEvent.Data.Object is StripeInvoice paidInv)
                            {
                                await MirrorInvoiceFromStripeAsync(paidInv);
                                await ApplyInvoicePaidAsync(paidInv);
                            }
                            break;

                        case "invoice.payment_failed":
                            if (stripeEvent.Data.Object is StripeInvoice failedInv)
                            {
                                await MirrorInvoiceFromStripeAsync(failedInv);
                                await ApplyInvoicePaymentFailedAsync(failedInv);
                            }
                            break;

                        // View Invoice feature: capture hosted URL + PDF link as soon as Stripe finalizes.
                        case "invoice.finalized":
                            if (stripeEvent.Data.Object is StripeInvoice finalInv)
                                await MirrorInvoiceFromStripeAsync(finalInv);
                            break;

                        case "invoice.voided":
                            if (stripeEvent.Data.Object is StripeInvoice voidInv)
                                await MirrorInvoiceFromStripeAsync(voidInv, markVoided: true);
                            break;
                    }
                    // Other event types (checkout.session.expired, etc.) are recorded for audit but not acted on.

                    record.ProcessedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();
                    return ApiResponseFactory.Success(true);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing Stripe event {EventId} ({EventType})",
                        stripeEvent.Id, stripeEvent.Type);
                    record.ProcessingError = ex.Message;
                    await _db.SaveChangesAsync();
                    return ApiResponseFactory.InternalError<bool>(ex.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error in Stripe webhook handler");
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        private async Task ApplyCheckoutCompletedAsync(Stripe.Checkout.Session session)
        {
            // Mode=subscription branch: Stripe has just created a recurring Subscription.
            // Mirror its state into our DB. The subsequent customer.subscription.created
            // webhook also fires, but we don't wait — the sooner the user sees their plan
            // the better. Both paths are idempotent.
            if (string.Equals(session.Mode, "subscription", StringComparison.OrdinalIgnoreCase))
            {
                await ApplySubscribeCheckoutCompletedAsync(session);
                return;
            }

            // Mode=payment branch (one-time charge): could be a plan upgrade, an add-on
            // purchase, or an OpenAPI credit top-up. Discriminate by session metadata["intent"]:
            //   "addon"        → AddOnService applies the add-on
            //   "credit_topup" → CustomerCreditService credits the wallet
            //   otherwise      → existing PendingUpgrade plan-change flow
            if (session.Metadata != null
                && session.Metadata.TryGetValue("intent", out var intent))
            {
                if (string.Equals(intent, "addon", StringComparison.OrdinalIgnoreCase))
                {
                    await _addOnService.ApplyAddOnCheckoutCompletedAsync(session);
                    return;
                }
                if (string.Equals(intent, "credit_topup", StringComparison.OrdinalIgnoreCase))
                {
                    await ApplyCreditTopUpCheckoutCompletedAsync(session);
                    return;
                }
            }

            // Mode=payment branch (existing one-time-charge upgrade flow):
            // Only act on actually-paid sessions. Stripe also fires this event for
            // unpaid async payment methods, but we only enabled "card" so this is a guard.
            if (!string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Session {SessionId} completed but payment_status={Status}, skipping",
                    session.Id, session.PaymentStatus);
                return;
            }

            var pending = await _db.PendingUpgrades
                .FirstOrDefaultAsync(p => p.SessionId == session.Id);

            if (pending == null)
            {
                _logger.LogWarning("No PendingUpgrade row for session {SessionId} — nothing to apply", session.Id);
                return;
            }

            if (pending.CompletedAt != null)
            {
                _logger.LogInformation("PendingUpgrade {SessionId} already completed", session.Id);
                return;
            }

            // Apply the plan change via the existing service so audit history is written
            // exactly like a direct change.
            var changeResult = await _subscriptionService.ChangeSubscriptionAsync(
                new ChangeSubscriptionDto
                {
                    CustomerId = pending.CustomerId,
                    NewPlanId = pending.NewPlanId,
                    EffectiveDate = DateTime.UtcNow,
                    Notes = pending.Notes ?? "Stripe upgrade payment"
                },
                changedBy: pending.RequestedByUserId ?? 0);

            if (!changeResult.IsSuccess)
            {
                throw new InvalidOperationException(
                    $"Plan change failed for customer {pending.CustomerId}: {changeResult.Message}");
            }

            // Flip IsPaid + record the Stripe session for audit.
            var sub = await _db.Subscriptions
                .FirstOrDefaultAsync(s => s.CustomerId == pending.CustomerId);
            if (sub != null)
            {
                sub.IsPaid = true;
                sub.LastPaymentAt = DateTime.UtcNow;
                sub.StripeLastSessionId = session.Id;
            }

            // Persist Stripe Customer id if it was newly created during checkout.
            if (!string.IsNullOrWhiteSpace(session.CustomerId))
            {
                var cust = await _db.Customers.FirstOrDefaultAsync(c => c.CustomerId == pending.CustomerId);
                if (cust != null && string.IsNullOrWhiteSpace(cust.StripeCustomerId))
                    cust.StripeCustomerId = session.CustomerId;
            }

            pending.CompletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Applied Stripe upgrade for customer {CustomerId} → plan {PlanId} (session {SessionId})",
                pending.CustomerId, pending.NewPlanId, session.Id);
        }

        // ─── Phase 3: Direct subscription management ─────────────────────────

        public async Task<ApiResponse<bool>> ChangeSubscriptionPlanAsync(int customerId, ChangeSubscriptionPlanDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");

                var sub = await _db.Subscriptions
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);
                if (sub == null || string.IsNullOrWhiteSpace(sub.StripeSubscriptionId))
                    return ApiResponseFactory.BadRequest<bool>(
                        "No active Stripe subscription. Use Subscribe flow first.");

                var newPlan = await EnsurePlanSyncedAsync(dto.NewPlanId);
                if (newPlan == null || !newPlan.IsActive)
                    return ApiResponseFactory.NotFound<bool>("Plan not found or inactive.");

                if (string.IsNullOrWhiteSpace(newPlan.StripeMonthlyPriceId))
                    return ApiResponseFactory.BadRequest<bool>(
                        "Plan auto-sync to Stripe failed. Check API logs for details.");

                var subSvc = new Stripe.SubscriptionService();

                // Fetch current sub to find the existing item id we need to replace.
                var currentSub = await subSvc.GetAsync(sub.StripeSubscriptionId);
                var existingItem = currentSub.Items?.Data?.FirstOrDefault();
                if (existingItem == null)
                    return ApiResponseFactory.InternalError<bool>("Subscription has no items.");

                // Update: replace the existing item's Price with the new Plan's Price.
                // proration_behavior=create_prorations → Stripe charges/credits the difference now.
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
                    ProrationBehavior = "create_prorations",
                    Metadata = new Dictionary<string, string>
                    {
                        ["customer_id"] = customerId.ToString(),
                        ["plan_id"] = newPlan.Id.ToString(),
                        ["change_notes"] = dto.Notes ?? ""
                    }
                });

                // Mirror immediately so the UI reflects the change. Webhook will also fire and is idempotent.
                await MirrorSubscriptionStateAsync(updated);

                // Plan changes typically generate a proration invoice. Pull it inline so it
                // shows in Invoice History right after the toast — same reason as Subscribe:
                // localhost dev has no webhook tunnel, but users still expect to see the invoice.
                await TryMirrorLatestInvoiceForSubAsync(updated);

                return ApiResponseFactory.Success(true, "Plan updated.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error changing plan for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error changing plan for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<UpcomingInvoicePreviewDto>> PreviewPlanChangeAsync(int customerId, int newPlanId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<UpcomingInvoicePreviewDto>("Stripe is not configured.");

                var sub = await _db.Subscriptions
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);
                if (sub == null || string.IsNullOrWhiteSpace(sub.StripeSubscriptionId))
                    return ApiResponseFactory.BadRequest<UpcomingInvoicePreviewDto>("No active Stripe subscription.");

                var newPlan = await EnsurePlanSyncedAsync(newPlanId);
                if (newPlan == null || string.IsNullOrWhiteSpace(newPlan.StripeMonthlyPriceId))
                    return ApiResponseFactory.NotFound<UpcomingInvoicePreviewDto>("Plan not found or auto-sync failed.");

                var customer = await _db.Customers.FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null || string.IsNullOrWhiteSpace(customer.StripeCustomerId))
                    return ApiResponseFactory.BadRequest<UpcomingInvoicePreviewDto>("Customer has no Stripe id.");

                var subSvc = new Stripe.SubscriptionService();
                var currentSub = await subSvc.GetAsync(sub.StripeSubscriptionId);
                var existingItem = currentSub.Items?.Data?.FirstOrDefault();
                if (existingItem == null)
                    return ApiResponseFactory.InternalError<UpcomingInvoicePreviewDto>("Subscription has no items.");

                var invoiceSvc = new InvoiceService();
                var preview = await invoiceSvc.CreatePreviewAsync(new InvoiceCreatePreviewOptions
                {
                    Customer = customer.StripeCustomerId,
                    Subscription = sub.StripeSubscriptionId,
                    SubscriptionDetails = new InvoiceSubscriptionDetailsOptions
                    {
                        Items = new List<InvoiceSubscriptionDetailsItemOptions>
                        {
                            new InvoiceSubscriptionDetailsItemOptions
                            {
                                Id = existingItem.Id,
                                Price = newPlan.StripeMonthlyPriceId
                            }
                        },
                        ProrationBehavior = "create_prorations"
                    }
                });

                // Stripe.net 48 dropped the direct `Proration` property on InvoiceLineItem.
                // Description usually starts with "Unused time" / "Remaining time" for prorations,
                // which is good enough for our UI label.
                var lines = preview.Lines?.Data?
                    .Select(l => new UpcomingInvoiceLineDto
                    {
                        Description = l.Description ?? string.Empty,
                        Amount = (l.Amount) / 100m,
                        IsProration = (l.Description ?? string.Empty).Contains("time", StringComparison.OrdinalIgnoreCase)
                    })
                    .ToList() ?? new List<UpcomingInvoiceLineDto>();

                var dto = new UpcomingInvoicePreviewDto
                {
                    AmountDueNow = (preview.AmountDue) / 100m,
                    NextCycleAmount = newPlan.Price,
                    NextBillingDate = sub.CurrentPeriodEnd,
                    Currency = preview.Currency ?? "usd",
                    Lines = lines
                };

                return ApiResponseFactory.Success(dto);
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error previewing plan change for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<UpcomingInvoicePreviewDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error previewing plan change for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<UpcomingInvoicePreviewDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> CancelSubscriptionAsync(int customerId)
        {
            return await SetCancelAtPeriodEndAsync(customerId, true, "canceled");
        }

        public async Task<ApiResponse<bool>> ReactivateSubscriptionAsync(int customerId)
        {
            return await SetCancelAtPeriodEndAsync(customerId, false, "reactivated");
        }

        private async Task<ApiResponse<bool>> SetCancelAtPeriodEndAsync(int customerId, bool cancel, string verb)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");

                var sub = await _db.Subscriptions
                    .FirstOrDefaultAsync(s => s.CustomerId == customerId);
                if (sub == null || string.IsNullOrWhiteSpace(sub.StripeSubscriptionId))
                    return ApiResponseFactory.BadRequest<bool>("No active Stripe subscription.");

                var subSvc = new Stripe.SubscriptionService();
                var updated = await subSvc.UpdateAsync(sub.StripeSubscriptionId, new SubscriptionUpdateOptions
                {
                    CancelAtPeriodEnd = cancel
                });

                await MirrorSubscriptionStateAsync(updated);

                return ApiResponseFactory.Success(true, $"Subscription {verb}.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error {Verb} subscription for customer {CustomerId}", verb, customerId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error {Verb} subscription for customer {CustomerId}", verb, customerId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<CustomerPortalSessionDto>> CreateCustomerPortalSessionAsync(int customerId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<CustomerPortalSessionDto>("Stripe is not configured.");

                var customer = await _db.Customers.FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<CustomerPortalSessionDto>("Customer not found.");

                if (string.IsNullOrWhiteSpace(customer.StripeCustomerId))
                    return ApiResponseFactory.BadRequest<CustomerPortalSessionDto>(
                        "Customer hasn't subscribed yet — no Stripe Customer to manage.");

                var frontendBase = (_settings.FrontendBaseUrl ?? "").TrimEnd('/');
                var returnUrl = $"{frontendBase}/licenses-billing";

                var portalSvc = new Stripe.BillingPortal.SessionService();
                var session = await portalSvc.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
                {
                    Customer = customer.StripeCustomerId,
                    ReturnUrl = returnUrl
                });

                return ApiResponseFactory.Success(new CustomerPortalSessionDto { Url = session.Url });
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "Stripe error creating portal session for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CustomerPortalSessionDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating portal session for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CustomerPortalSessionDto>(ex.Message);
            }
        }

        // ─── Phase 2: subscription mode handlers ─────────────────────────────

        /// <summary>
        /// Mode=subscription branch of checkout.session.completed.
        /// At this point Stripe has created a Customer (if new), saved the PaymentMethod,
        /// created a Subscription, and paid the first Invoice. We mirror the subscription
        /// state to our DB so the user immediately sees the new plan when they return.
        /// </summary>
        private async Task ApplySubscribeCheckoutCompletedAsync(Stripe.Checkout.Session session)
        {
            var pending = await _db.PendingUpgrades
                .FirstOrDefaultAsync(p => p.SessionId == session.Id);

            // Persist the Stripe Customer id back if Stripe assigned one during this session.
            int? customerIdFromMetadata = null;
            if (session.Metadata != null
                && session.Metadata.TryGetValue("customer_id", out var custIdStr)
                && int.TryParse(custIdStr, out var custId))
            {
                customerIdFromMetadata = custId;
            }

            int targetCustomerId = pending?.CustomerId ?? customerIdFromMetadata ?? 0;
            if (targetCustomerId == 0)
            {
                _logger.LogWarning("Subscribe session {SessionId} has no customer_id metadata or pending row", session.Id);
                return;
            }

            var customer = await _db.Customers
                .Include(c => c.Subscription)
                .FirstOrDefaultAsync(c => c.CustomerId == targetCustomerId);
            if (customer == null) return;

            if (!string.IsNullOrWhiteSpace(session.CustomerId)
                && string.IsNullOrWhiteSpace(customer.StripeCustomerId))
            {
                customer.StripeCustomerId = session.CustomerId;
            }

            // Fetch the actual Stripe Subscription so we get period dates.
            // Mirror its state, then pull the first invoice it generated so it lands
            // in our DB inline — without this, localhost dev (no webhook tunnel) wouldn't
            // see the just-bought plan's invoice until a manual Sync Invoices click.
            StripeSubscription? stripeSubForInvoice = null;
            if (!string.IsNullOrWhiteSpace(session.SubscriptionId))
            {
                var subSvc = new Stripe.SubscriptionService();
                stripeSubForInvoice = await subSvc.GetAsync(session.SubscriptionId);
                await MirrorSubscriptionStateAsync(stripeSubForInvoice);
            }

            if (pending != null && pending.CompletedAt == null)
            {
                pending.CompletedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();

            // After the sub row is committed, pull the initial invoice and mirror it.
            // Done after SaveChanges so any FK to the (possibly new) Subscription row
            // is already resolvable, and the invoice mirror does its own SaveChanges.
            if (stripeSubForInvoice != null)
            {
                await TryMirrorLatestInvoiceForSubAsync(stripeSubForInvoice);
            }

            _logger.LogInformation(
                "Subscribe completed: customer {CustomerId} (Stripe sub {SubId})",
                targetCustomerId, session.SubscriptionId);
        }

        /// <summary>
        /// Maps a Stripe.Subscription onto our Subscription row. Used for both
        /// customer.subscription.created and customer.subscription.updated events,
        /// plus inline from the subscribe-completed flow.
        /// </summary>
        private async Task MirrorSubscriptionStateAsync(StripeSubscription stripeSub)
        {
            // Identify our customer either by metadata (preferred) or by StripeCustomerId.
            int? ourCustomerId = null;
            if (stripeSub.Metadata != null
                && stripeSub.Metadata.TryGetValue("customer_id", out var metaCustId)
                && int.TryParse(metaCustId, out var parsedCustId))
            {
                ourCustomerId = parsedCustId;
            }

            var customer = ourCustomerId.HasValue
                ? await _db.Customers.Include(c => c.Subscription).FirstOrDefaultAsync(c => c.CustomerId == ourCustomerId.Value)
                : await _db.Customers.Include(c => c.Subscription).FirstOrDefaultAsync(c => c.StripeCustomerId == stripeSub.CustomerId);

            if (customer == null)
            {
                _logger.LogWarning("MirrorSubscriptionState: no customer found for Stripe sub {SubId}", stripeSub.Id);
                return;
            }

            // Resolve the Plan from the active subscription item's Price → Plan.StripeMonthlyPriceId.
            int? planId = null;
            var firstItem = stripeSub.Items?.Data?.FirstOrDefault();
            if (firstItem != null)
            {
                var priceId = firstItem.Price?.Id;
                if (!string.IsNullOrWhiteSpace(priceId))
                {
                    var plan = await _db.Plans.FirstOrDefaultAsync(p =>
                        p.StripeMonthlyPriceId == priceId || p.StripeYearlyPriceId == priceId);
                    if (plan != null) planId = plan.Id;
                }
            }

            // Stripe.net 48 / API 2025+: CurrentPeriod* moved from sub level to per-item.
            var periodStart = firstItem?.CurrentPeriodStart;
            var periodEnd = firstItem?.CurrentPeriodEnd;

            // Upsert our Subscription row. New tenant: create. Existing: update.
            if (customer.Subscription == null)
            {
                customer.Subscription = new BackOffice.Domain.Entities.Main.Subscription
                {
                    CustomerId = customer.CustomerId,
                    PlanId = planId ?? 0,
                    Status = MapStripeStatusToDomain(stripeSub.Status),
                    StartDate = periodStart,
                    EndDate = periodEnd,
                    BillingCycleMonths = 1,
                    IsPaid = string.Equals(stripeSub.Status, "active", StringComparison.OrdinalIgnoreCase)
                          || string.Equals(stripeSub.Status, "trialing", StringComparison.OrdinalIgnoreCase),
                    LastPaymentAt = DateTime.UtcNow,
                    StripeSubscriptionId = stripeSub.Id,
                    CurrentPeriodStart = periodStart,
                    CurrentPeriodEnd = periodEnd,
                    CancelAtPeriodEnd = stripeSub.CancelAtPeriodEnd,
                    CanceledAt = stripeSub.CanceledAt,
                    DefaultPaymentMethodId = stripeSub.DefaultPaymentMethodId
                };
            }
            else
            {
                var sub = customer.Subscription;
                if (planId.HasValue) sub.PlanId = planId.Value;
                sub.Status = MapStripeStatusToDomain(stripeSub.Status);
                sub.StripeSubscriptionId = stripeSub.Id;
                sub.CurrentPeriodStart = periodStart;
                sub.CurrentPeriodEnd = periodEnd;
                sub.StartDate = periodStart;
                sub.EndDate = periodEnd;
                sub.CancelAtPeriodEnd = stripeSub.CancelAtPeriodEnd;
                sub.CanceledAt = stripeSub.CanceledAt;
                sub.DefaultPaymentMethodId = stripeSub.DefaultPaymentMethodId;
                if (string.Equals(stripeSub.Status, "active", StringComparison.OrdinalIgnoreCase)
                 || string.Equals(stripeSub.Status, "trialing", StringComparison.OrdinalIgnoreCase))
                {
                    sub.IsPaid = true;
                }
            }

            await _db.SaveChangesAsync();
        }

        private async Task MirrorSubscriptionDeletedAsync(StripeSubscription stripeSub)
        {
            var sub = await _db.Subscriptions
                .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSub.Id);
            if (sub == null) return;

            sub.Status = SubscriptionStatus.Cancelled;
            sub.CanceledAt = stripeSub.CanceledAt ?? DateTime.UtcNow;
            sub.IsPaid = false;
            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Mirrors the non-base Subscription Items into the SubscriptionAddOns table.
        /// Stripe is the source of truth — we reconcile our local rows against the
        /// items returned by Stripe.
        ///
        /// Item classification:
        ///   - Base plan item:   Price matches Plan.StripeMonthlyPriceId/StripeYearlyPriceId
        ///   - Overage item:     Price matches a PlanAppPricing.StripeOveragePriceId
        ///   - Anything else:    Ignored (could be a one-off addon Stripe-side, not tracked here)
        ///
        /// Idempotent — safe to re-run on every webhook fire.
        /// </summary>
        private async Task MirrorSubscriptionAddOnsAsync(StripeSubscription stripeSub)
        {
            var localSub = await _db.Subscriptions
                .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSub.Id);
            if (localSub == null) return;

            // Build a lookup of {Stripe overage price id → PlanAppPricing} so we can
            // match items in O(1) and pull the metadata we need to mirror.
            var pricingRows = await _db.PlanAppPricings
                .Where(p => p.StripeOveragePriceId != null)
                .ToListAsync();
            var pricingByPriceId = pricingRows
                .Where(p => !string.IsNullOrWhiteSpace(p.StripeOveragePriceId))
                .ToDictionary(p => p.StripeOveragePriceId!, p => p, StringComparer.Ordinal);

            var existingAddOns = await _db.SubscriptionAddOns
                .Where(a => a.SubscriptionId == localSub.Id)
                .ToListAsync();

            var now = DateTime.UtcNow;
            var seenPriceIds = new HashSet<string>(StringComparer.Ordinal);

            foreach (var item in stripeSub.Items?.Data ?? new List<SubscriptionItem>())
            {
                var priceId = item.Price?.Id;
                if (string.IsNullOrWhiteSpace(priceId)) continue;
                if (!pricingByPriceId.TryGetValue(priceId, out var pricing)) continue;

                seenPriceIds.Add(priceId);
                // Stripe.net SubscriptionItem.Quantity is non-nullable long; default 1 if missing.
                var qty = item.Quantity > 0 ? (int)item.Quantity : 1;

                var existing = existingAddOns.FirstOrDefault(a =>
                    a.StripePriceId == priceId || a.StripeSubscriptionItemId == item.Id);

                if (existing == null)
                {
                    _db.SubscriptionAddOns.Add(new SubscriptionAddOn
                    {
                        SubscriptionId = localSub.Id,
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
                    existing.Quantity = qty;
                    existing.StripeSubscriptionItemId = item.Id;
                    existing.UnitAmount = pricing.PricePerUnit;
                    existing.RemovedAt = null;
                }
            }

            // Anything we had that Stripe no longer lists → mark removed.
            foreach (var leftover in existingAddOns)
            {
                if (string.IsNullOrWhiteSpace(leftover.StripePriceId)) continue;
                if (seenPriceIds.Contains(leftover.StripePriceId)) continue;
                if (leftover.RemovedAt != null) continue;

                leftover.Quantity = 0;
                leftover.RemovedAt = now;
            }

            await _db.SaveChangesAsync();
        }

        // Stripe.net 48 / API 2025+: Invoice.SubscriptionId moved under Invoice.Parent.SubscriptionDetails.
        private static string? GetInvoiceSubscriptionId(StripeInvoice invoice)
            => invoice?.Parent?.SubscriptionDetails?.SubscriptionId;

        private async Task ApplyInvoicePaidAsync(StripeInvoice invoice)
        {
            var subId = GetInvoiceSubscriptionId(invoice);
            if (string.IsNullOrWhiteSpace(subId)) return;

            var sub = await _db.Subscriptions
                .FirstOrDefaultAsync(s => s.StripeSubscriptionId == subId);
            if (sub == null) return;

            sub.IsPaid = true;
            sub.LastPaymentAt = DateTime.UtcNow;

            // Pull updated period from Stripe so renewal extends the cycle.
            try
            {
                var subSvc = new Stripe.SubscriptionService();
                var stripeSub = await subSvc.GetAsync(subId);
                var item = stripeSub.Items?.Data?.FirstOrDefault();
                sub.CurrentPeriodStart = item?.CurrentPeriodStart;
                sub.CurrentPeriodEnd = item?.CurrentPeriodEnd;
                sub.EndDate = item?.CurrentPeriodEnd;
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "ApplyInvoicePaid: lookup failed for sub {SubId}", subId);
            }

            await _db.SaveChangesAsync();
            _logger.LogInformation("invoice.paid → sub {SubId} marked paid, period extended", subId);
        }

        private async Task ApplyInvoicePaymentFailedAsync(StripeInvoice invoice)
        {
            var subId = GetInvoiceSubscriptionId(invoice);
            if (string.IsNullOrWhiteSpace(subId)) return;

            var sub = await _db.Subscriptions
                .FirstOrDefaultAsync(s => s.StripeSubscriptionId == subId);
            if (sub == null) return;

            // Flag past-due. Stripe will keep retrying per Smart Retries.
            sub.Status = SubscriptionStatus.PastDue;
            await _db.SaveChangesAsync();
            _logger.LogWarning("invoice.payment_failed → sub {SubId} marked PastDue", subId);
        }

        /// <summary>
        /// Upserts a row in our Invoices table from a Stripe.Invoice. Captures HostedInvoiceUrl
        /// and InvoicePdfUrl so the "View Invoice" button can deep-link to the Stripe-hosted page.
        /// Also called from the SyncInvoicesFromStripe admin backfill.
        /// </summary>
        internal async Task MirrorInvoiceFromStripeAsync(StripeInvoice stripeInvoice, bool markVoided = false)
        {
            // Find our customer from Stripe customer id (or invoice metadata).
            BackOffice.Domain.Entities.Main.Customer? customer = null;
            if (!string.IsNullOrWhiteSpace(stripeInvoice.CustomerId))
            {
                customer = await _db.Customers.FirstOrDefaultAsync(c => c.StripeCustomerId == stripeInvoice.CustomerId);
            }
            if (customer == null && stripeInvoice.Metadata != null
                && stripeInvoice.Metadata.TryGetValue("customer_id", out var metaCustId)
                && int.TryParse(metaCustId, out var custId))
            {
                customer = await _db.Customers.FirstOrDefaultAsync(c => c.CustomerId == custId);
            }
            if (customer == null)
            {
                _logger.LogWarning("MirrorInvoice: no customer matched Stripe invoice {InvoiceId}", stripeInvoice.Id);
                return;
            }

            var invoice = await _db.Invoices
                .Include(i => i.LineItems)
                .FirstOrDefaultAsync(i => i.StripeInvoiceId == stripeInvoice.Id);

            var isNew = invoice == null;
            if (isNew)
            {
                invoice = new BackOffice.Domain.Entities.Main.Invoice
                {
                    CustomerId = customer.CustomerId,
                    InvoiceNumber = stripeInvoice.Number ?? stripeInvoice.Id,
                    BillingPeriodStart = stripeInvoice.PeriodStart,
                    BillingPeriodEnd = stripeInvoice.PeriodEnd,
                    IssuedAt = stripeInvoice.Created,
                    DueDate = stripeInvoice.DueDate ?? stripeInvoice.Created,
                    Notes = "Created from Stripe webhook",
                    CreatedAt = DateTime.UtcNow,
                    LineItems = new List<BackOffice.Domain.Entities.Main.InvoiceLineItem>()
                };
                _db.Invoices.Add(invoice);
            }

            // Always refresh these from Stripe (Stripe is the source of truth).
            invoice!.StripeInvoiceId = stripeInvoice.Id;
            invoice.HostedInvoiceUrl = stripeInvoice.HostedInvoiceUrl;
            invoice.InvoicePdfUrl = stripeInvoice.InvoicePdf;
            invoice.SubTotal = stripeInvoice.Subtotal / 100m;
            invoice.TotalAmount = stripeInvoice.Total / 100m;
            // Stripe.net 48 removed the direct Tax accessor; derive from Total - Subtotal.
            invoice.TaxAmount = (stripeInvoice.Total - stripeInvoice.Subtotal) / 100m;
            invoice.Status = markVoided ? InvoiceStatus.Void : MapStripeInvoiceStatus(stripeInvoice.Status);
            if (string.Equals(stripeInvoice.Status, "paid", StringComparison.OrdinalIgnoreCase) && invoice.PaidAt == null)
            {
                invoice.PaidAt = stripeInvoice.StatusTransitions?.PaidAt ?? DateTime.UtcNow;
                invoice.PaymentReference = stripeInvoice.Id;
            }

            // Sync line items on first import (keep simple — don't try to diff existing).
            if (isNew && stripeInvoice.Lines?.Data != null)
            {
                foreach (StripeInvoiceLineItem line in stripeInvoice.Lines.Data)
                {
                    var qty = (int)(line.Quantity ?? 1);
                    var lineTotal = line.Amount / 100m;
                    invoice.LineItems.Add(new BackOffice.Domain.Entities.Main.InvoiceLineItem
                    {
                        Description = line.Description ?? string.Empty,
                        Category = "stripe",
                        Quantity = qty,
                        FreeUnits = 0,
                        BillableUnits = qty,
                        UnitPrice = qty > 0 ? lineTotal / qty : lineTotal,
                        LineTotal = lineTotal
                    });
                }
            }

            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Best-effort helper: when a Stripe Subscription is mirrored, also pull its
        /// most recent invoice (referenced by stripeSub.LatestInvoiceId) and upsert it
        /// into our Invoices table. This is the inline equivalent of the invoice.paid
        /// webhook handler, used so localhost dev (no webhook tunnel) still sees the
        /// invoice show up in the History panel immediately after a plan purchase.
        ///
        /// Production-safe by design:
        ///   1. Gated by StripeSettings.AutoMirrorInvoicesOnCheckout — can be disabled
        ///      to rely solely on webhooks.
        ///   2. Pre-checks the local DB — if the webhook already mirrored this invoice
        ///      (race scenario in prod), no Stripe API call is made.
        ///   3. Wraps the Stripe API call in a short timeout — slow Stripe never hangs
        ///      the user-facing request; the webhook is the durable backstop.
        ///   4. Wraps everything in try/catch — never let a missing invoice block the
        ///      sub mirror. Failure here is fully recoverable via webhook or manual sync.
        ///   5. MirrorInvoiceFromStripeAsync uses upsert semantics keyed on StripeInvoiceId,
        ///      so the inline path and the webhook path are mutually idempotent: whichever
        ///      arrives first wins, the second is a no-op.
        /// </summary>
        internal async Task TryMirrorLatestInvoiceForSubAsync(StripeSubscription stripeSub)
        {
            if (stripeSub == null || string.IsNullOrWhiteSpace(stripeSub.LatestInvoiceId))
            {
                return;
            }

            // Production opt-out: webhooks alone may be sufficient at scale.
            if (!_settings.AutoMirrorInvoicesOnCheckout)
            {
                _logger.LogDebug(
                    "AutoMirrorInvoicesOnCheckout=false — skipping inline invoice pull for sub {SubId}",
                    stripeSub.Id);
                return;
            }

            // Race-safe pre-check: if the webhook beat us to it, skip the Stripe API call.
            var alreadyMirrored = await _db.Invoices
                .AsNoTracking()
                .AnyAsync(i => i.StripeInvoiceId == stripeSub.LatestInvoiceId);
            if (alreadyMirrored)
            {
                _logger.LogDebug(
                    "Invoice {InvoiceId} already mirrored (likely by webhook) — skipping inline pull",
                    stripeSub.LatestInvoiceId);
                return;
            }

            // Short timeout so a slow Stripe API never hangs the user-facing request.
            var timeoutSecs = Math.Max(1, _settings.InlineInvoiceFetchTimeoutSeconds);
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSecs));

            try
            {
                var invSvc = new InvoiceService();
                var latestInv = await invSvc.GetAsync(
                    stripeSub.LatestInvoiceId,
                    options: null,
                    requestOptions: null,
                    cancellationToken: cts.Token);
                if (latestInv != null)
                {
                    await MirrorInvoiceFromStripeAsync(latestInv);
                    _logger.LogInformation(
                        "Mirrored latest invoice {InvoiceId} for Stripe sub {SubId} inline",
                        latestInv.Id, stripeSub.Id);
                }
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation(
                    "Inline invoice pull for sub {SubId} timed out after {Timeout}s — webhook will mirror it",
                    stripeSub.Id, timeoutSecs);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "TryMirrorLatestInvoiceForSub: failed to pull invoice {InvoiceId} for sub {SubId}; webhook backstop will catch it",
                    stripeSub.LatestInvoiceId, stripeSub.Id);
            }
        }

        private static InvoiceStatus MapStripeInvoiceStatus(string? stripeStatus) => stripeStatus?.ToLowerInvariant() switch
        {
            "draft" => InvoiceStatus.Draft,
            "open" => InvoiceStatus.Issued,
            "paid" => InvoiceStatus.Paid,
            "uncollectible" => InvoiceStatus.PastDue,
            "void" => InvoiceStatus.Void,
            _ => InvoiceStatus.Issued
        };

        private static SubscriptionStatus MapStripeStatusToDomain(string stripeStatus) => stripeStatus?.ToLowerInvariant() switch
        {
            "active" => SubscriptionStatus.Active,
            "trialing" => SubscriptionStatus.Trial,
            "past_due" => SubscriptionStatus.PastDue,
            "unpaid" => SubscriptionStatus.PastDue,
            "canceled" => SubscriptionStatus.Cancelled,
            "incomplete" => SubscriptionStatus.PastDue,
            "incomplete_expired" => SubscriptionStatus.Cancelled,
            "paused" => SubscriptionStatus.Suspended,
            _ => SubscriptionStatus.Active
        };

        // ─── OpenAPI prepaid-credit top-up ──────────────────────────────────

        public async Task<ApiResponse<CheckoutSessionResultDto>> CreateCreditTopUpSessionAsync(
            int customerId,
            int requestedByUserId,
            decimal amount)
        {
            _logger.LogInformation(
                "TOPUP_TRACE CreateCreditTopUpSession ENTER customer={CustomerId} amount={Amount} byUser={UserId}",
                customerId, amount, requestedByUserId);
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<CheckoutSessionResultDto>("Stripe is not configured.");

                if (amount < 5m || amount > 5000m)
                    return ApiResponseFactory.BadRequest<CheckoutSessionResultDto>("Amount must be between 5 and 5000.");

                var customer = await _db.Customers
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<CheckoutSessionResultDto>("Customer not found.");

                // Make the Stripe Customer linkage an explicit prerequisite step.
                // Race-safe (catches orphans from prior failed lazy-creates) and
                // surfaces a clear error if Stripe is unreachable, instead of
                // hiding inside the checkout-session error.
                var ensure = await EnsureStripeCustomerAsync(customerId);
                if (!ensure.IsSuccess || ensure.Response == null
                    || string.IsNullOrWhiteSpace(ensure.Response.StripeCustomerId))
                {
                    return ApiResponseFactory.InternalError<CheckoutSessionResultDto>(
                        $"Could not link Stripe customer: {ensure.Message}");
                }
                var stripeCustomerId = ensure.Response.StripeCustomerId;

                var frontendBase = (_settings.FrontendBaseUrl ?? "").TrimEnd('/');
                var successUrl = $"{frontendBase}/licenses-billing?topup=success&session_id={{CHECKOUT_SESSION_ID}}";
                var cancelUrl = $"{frontendBase}/licenses-billing?topup=canceled";

                var currency = string.IsNullOrWhiteSpace(_settings.Currency) ? "usd" : _settings.Currency;

                var sessionOptions = new Stripe.Checkout.SessionCreateOptions
                {
                    Mode = "payment",
                    Customer = stripeCustomerId,
                    PaymentMethodTypes = new List<string> { "card" },
                    LineItems = new List<Stripe.Checkout.SessionLineItemOptions>
                    {
                        new Stripe.Checkout.SessionLineItemOptions
                        {
                            Quantity = 1,
                            PriceData = new Stripe.Checkout.SessionLineItemPriceDataOptions
                            {
                                Currency = currency,
                                UnitAmount = (long)(amount * 100m),    // smallest currency unit
                                ProductData = new Stripe.Checkout.SessionLineItemPriceDataProductDataOptions
                                {
                                    Name = "OpenAPI credit top-up",
                                    Description = $"Prepaid API credit: {amount:0.00} {currency.ToUpperInvariant()}"
                                }
                            }
                        }
                    },
                    SuccessUrl = successUrl,
                    CancelUrl = cancelUrl,
                    PaymentIntentData = new Stripe.Checkout.SessionPaymentIntentDataOptions
                    {
                        Metadata = new Dictionary<string, string>
                        {
                            ["customer_id"] = customer.CustomerId.ToString(),
                            ["intent"] = "credit_topup",
                            ["topup_amount"] = amount.ToString("0.00")
                        }
                    },
                    Metadata = new Dictionary<string, string>
                    {
                        ["customer_id"] = customer.CustomerId.ToString(),
                        ["intent"] = "credit_topup",
                        ["topup_amount"] = amount.ToString("0.00"),
                        ["requested_by_user_id"] = requestedByUserId.ToString()
                    }
                };

                var sessionSvc = new Stripe.Checkout.SessionService();
                var session = await sessionSvc.CreateAsync(sessionOptions);

                _logger.LogInformation(
                    "TOPUP_TRACE CreateCreditTopUpSession STRIPE_SESSION_CREATED customer={CustomerId} amount={Amount} sessionId={SessionId} stripeCust={SCust} successUrl={SuccessUrl}",
                    customerId, amount, session.Id, stripeCustomerId, successUrl);

                return ApiResponseFactory.Success(new CheckoutSessionResultDto
                {
                    SessionId = session.Id,
                    Url = session.Url
                });
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex, "TOPUP_TRACE CreateCreditTopUpSession STRIPE_ERROR customer={CustomerId} amount={Amount} msg={Msg}", customerId, amount, sex.Message);
                return ApiResponseFactory.InternalError<CheckoutSessionResultDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TOPUP_TRACE CreateCreditTopUpSession ERROR customer={CustomerId} amount={Amount} msg={Msg}", customerId, amount, ex.Message);
                return ApiResponseFactory.InternalError<CheckoutSessionResultDto>(ex.Message);
            }
        }

        /// <summary>
        /// Polling-mode backstop called by the frontend after returning from Stripe
        /// Checkout. Mirrors what the webhook would do, used when the webhook isn't
        /// reachable (local dev). Idempotent — second call after a real webhook is a no-op.
        /// </summary>
        public async Task<ApiResponse<bool>> ReconcileCreditTopUpAsync(int customerId, string sessionId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");
                if (string.IsNullOrWhiteSpace(sessionId))
                    return ApiResponseFactory.BadRequest<bool>("sessionId is required.");

                var sessionSvc = new Stripe.Checkout.SessionService();
                Stripe.Checkout.Session session;
                try
                {
                    session = await sessionSvc.GetAsync(sessionId);
                }
                catch (StripeException sex) when (sex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return ApiResponseFactory.NotFound<bool>("Stripe session not found.");
                }

                // Validate this session belongs to the calling tenant (anti-spoofing).
                string? midStr = null;
                if (session.Metadata == null
                    || !session.Metadata.TryGetValue("customer_id", out midStr)
                    || !int.TryParse(midStr, out var midFromMeta)
                    || midFromMeta != customerId)
                {
                    _logger.LogWarning(
                        "Reconcile rejected: session {SessionId} customer_id metadata {Meta} does not match caller {CallerId}",
                        sessionId, midStr ?? "(missing)", customerId);
                    return ApiResponseFactory.Forbidden<bool>("Session does not belong to caller.");
                }

                if (!session.Metadata.TryGetValue("intent", out var intent)
                    || !string.Equals(intent, "credit_topup", StringComparison.OrdinalIgnoreCase))
                {
                    return ApiResponseFactory.BadRequest<bool>("Session is not a credit top-up.");
                }

                if (!string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
                {
                    // Not yet paid (async payment method still pending, or canceled).
                    // Surface as Success(false) so the frontend can decide what to show.
                    return ApiResponseFactory.Success(false,
                        $"Session not yet paid (status={session.PaymentStatus}).");
                }

                // Apply via the same handler the webhook uses. Idempotent on
                // PaymentIntentId so a late webhook is safe.
                await ApplyCreditTopUpCheckoutCompletedAsync(session);
                return ApiResponseFactory.Success(true, "Top-up reconciled.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex,
                    "Stripe error reconciling credit top-up customer={CustomerId} session={SessionId}",
                    customerId, sessionId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error reconciling credit top-up customer={CustomerId} session={SessionId}",
                    customerId, sessionId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        /// <summary>
        /// Broader recovery backstop. Lists every recent Checkout Session for the
        /// tenant's Stripe Customer and applies any paid credit_topup that isn't
        /// already on the ledger. Idempotent. Required when the redirect param was
        /// lost (browser back-button, popup blocker, different port, etc.) and the
        /// webhook never delivered (local dev). Returns full diagnostic counters so
        /// the panel can show *why* a tenant's wallet is empty when they say they paid.
        /// </summary>
        public async Task<ApiResponse<CreditTopUpRecoveryResultDto>> RecoverPendingCreditTopUpsAsync(int customerId)
        {
            var diag = new CreditTopUpRecoveryResultDto();

            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                {
                    diag.Note = "Stripe is not configured (missing SecretKey).";
                    return ApiResponseFactory.Success(diag, diag.Note);
                }

                var customer = await _db.Customers
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<CreditTopUpRecoveryResultDto>("Customer not found.");

                diag.HasStripeCustomer = !string.IsNullOrWhiteSpace(customer.StripeCustomerId);
                if (!diag.HasStripeCustomer)
                {
                    diag.Note = "This tenant has no Stripe Customer linked yet — there are no Stripe sessions to scan. " +
                                "Initiate one Add Credit checkout first; that creates the Stripe Customer.";
                    return ApiResponseFactory.Success(diag, diag.Note);
                }

                var sessionSvc = new Stripe.Checkout.SessionService();
                var sessions = await sessionSvc.ListAsync(new Stripe.Checkout.SessionListOptions
                {
                    Customer = customer.StripeCustomerId,
                    Limit = 50  // last 50 sessions is plenty for recovery; Stripe orders newest first
                });

                foreach (var session in sessions.Data)
                {
                    diag.Scanned++;

                    if (session.Metadata == null
                        || !session.Metadata.TryGetValue("intent", out var intent)
                        || !string.Equals(intent, "credit_topup", StringComparison.OrdinalIgnoreCase))
                    {
                        diag.SkippedNotCreditTopUp++;
                        continue;
                    }

                    if (!string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
                    {
                        diag.SkippedNotPaid++;
                        continue;
                    }

                    if (!session.Metadata.TryGetValue("customer_id", out var midStr)
                        || !int.TryParse(midStr, out var mid)
                        || mid != customerId)
                    {
                        diag.SkippedCustomerMismatch++;
                        _logger.LogWarning(
                            "Recovery skipped session {SessionId}: metadata customer_id={Meta} does not match caller {CallerId}",
                            session.Id, midStr ?? "(missing)", customerId);
                        continue;
                    }

                    if (string.IsNullOrWhiteSpace(session.PaymentIntentId))
                    {
                        diag.SkippedNoPaymentIntent++;
                        _logger.LogWarning(
                            "Recovery skipped session {SessionId}: no PaymentIntentId on a paid session (unexpected)",
                            session.Id);
                        continue;
                    }

                    // Idempotency check before calling the handler — lets us count
                    // "already applied" sessions distinctly from newly applied ones.
                    var alreadyApplied = await _db.CustomerCreditTransactions
                        .AnyAsync(t => t.StripePaymentIntentId == session.PaymentIntentId);

                    try
                    {
                        await ApplyCreditTopUpCheckoutCompletedAsync(session);
                        if (alreadyApplied) diag.AlreadyApplied++;
                        else diag.Applied++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex,
                            "Recovery failed to apply session {SessionId} for customer {CustomerId}",
                            session.Id, customerId);
                    }
                }

                _logger.LogInformation(
                    "Credit-topup recovery customer={CustomerId} scanned={Scanned} applied={Applied} alreadyApplied={Already} skippedNotCreditTopUp={SNC} skippedNotPaid={SNP} skippedCustomerMismatch={SCM} skippedNoPaymentIntent={SNPI}",
                    customerId, diag.Scanned, diag.Applied, diag.AlreadyApplied,
                    diag.SkippedNotCreditTopUp, diag.SkippedNotPaid,
                    diag.SkippedCustomerMismatch, diag.SkippedNoPaymentIntent);

                // Pick a human note that summarises the most informative outcome.
                if (diag.Applied > 0)
                    diag.Note = $"Recovered {diag.Applied} pending top-up(s).";
                else if (diag.Scanned == 0)
                    diag.Note = "Stripe returned no sessions for this tenant. Have you actually clicked Add Credit and completed a checkout?";
                else if (diag.SkippedNotCreditTopUp == diag.Scanned)
                    diag.Note = $"Scanned {diag.Scanned} session(s) but none were credit-top-ups (likely plan upgrades / subscribes / add-ons). " +
                                "If you completed an Add Credit checkout, it should show up here.";
                else if (diag.SkippedNotPaid > 0 && diag.SkippedNotPaid + diag.AlreadyApplied + diag.SkippedNotCreditTopUp == diag.Scanned)
                    diag.Note = "Found credit-top-up session(s) but Stripe says they aren't paid yet (canceled / expired / async pending).";
                else if (diag.SkippedCustomerMismatch > 0)
                    diag.Note = $"Found {diag.SkippedCustomerMismatch} paid credit-top-up session(s) whose metadata customer_id does NOT match this tenant. Anti-spoofing rejected them — check StripeCustomerId mapping.";
                else if (diag.AlreadyApplied > 0 && diag.Applied == 0)
                    diag.Note = $"All paid credit-top-ups for this tenant ({diag.AlreadyApplied}) were already on the ledger. Wallet balance reflects them.";
                else
                    diag.Note = "No new top-ups to recover.";

                return ApiResponseFactory.Success(diag, diag.Note);
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex,
                    "Stripe error recovering credit top-ups for customer {CustomerId}",
                    customerId);
                return ApiResponseFactory.InternalError<CreditTopUpRecoveryResultDto>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error recovering credit top-ups for customer {CustomerId}",
                    customerId);
                return ApiResponseFactory.InternalError<CreditTopUpRecoveryResultDto>(ex.Message);
            }
        }

        /// <summary>
        /// Read-only diagnostic: load a Stripe Checkout Session, dump every relevant
        /// field, compare it to the caller's BackOffice tenant, and return a verdict
        /// on whether Apply would succeed. No writes. Companion to ApplyBySessionId.
        /// </summary>
        public async Task<ApiResponse<CreditTopUpTraceDto>> TraceCreditTopUpAsync(int customerId, string sessionId)
        {
            var trace = new CreditTopUpTraceDto
            {
                SessionId = (sessionId ?? "").Trim(),
                CallerCustomerId = customerId
            };

            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                {
                    trace.Blockers.Add("Stripe is not configured (missing SecretKey).");
                    trace.Note = trace.Blockers[0];
                    return ApiResponseFactory.Success(trace, trace.Note);
                }
                if (string.IsNullOrWhiteSpace(trace.SessionId))
                {
                    trace.Blockers.Add("sessionId is required.");
                    trace.Note = trace.Blockers[0];
                    return ApiResponseFactory.Success(trace, trace.Note);
                }

                // Caller tenant snapshot.
                var customer = await _db.Customers
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<CreditTopUpTraceDto>("Caller customer not found.");
                trace.CallerStripeCustomerId = customer.StripeCustomerId;

                // Stripe session lookup.
                var sessionSvc = new Stripe.Checkout.SessionService();
                Stripe.Checkout.Session session;
                try
                {
                    session = await sessionSvc.GetAsync(trace.SessionId);
                    trace.SessionFound = true;
                }
                catch (StripeException sex) when (sex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    trace.SessionFound = false;
                    trace.Blockers.Add(
                        $"Stripe returned 404 for this Session ID. Confirm the BackOffice Stripe API key is in the SAME mode (test vs live) as the dashboard you copied the ID from.");
                    trace.Note = "Session not found.";
                    _logger.LogWarning(
                        "TopUp trace: caller={CallerId} sessionId={SessionId} NOT FOUND (mode mismatch likely)",
                        customerId, trace.SessionId);
                    return ApiResponseFactory.Success(trace, trace.Note);
                }

                // Snapshot Stripe-side facts.
                trace.PaymentStatus = session.PaymentStatus;
                trace.Mode = session.Mode;
                trace.StripeCustomerIdOnSession = session.CustomerId;
                trace.PaymentIntentId = session.PaymentIntentId;
                trace.AmountTotalCents = session.AmountTotal;
                trace.AmountFromSession = session.AmountTotal.HasValue
                    ? session.AmountTotal.Value / 100m
                    : (decimal?)null;

                if (session.Metadata != null)
                {
                    session.Metadata.TryGetValue("intent", out var i);
                    session.Metadata.TryGetValue("customer_id", out var m);
                    session.Metadata.TryGetValue("topup_amount", out var t);
                    trace.MetadataIntent = i;
                    trace.MetadataCustomerId = m;
                    trace.MetadataTopUpAmount = t;
                }

                // Match analysis.
                trace.SessionIsPaid = string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase);
                trace.IntentIsCreditTopUp = string.Equals(trace.MetadataIntent, "credit_topup", StringComparison.OrdinalIgnoreCase);
                trace.StripeCustomerMatchesCaller =
                    !string.IsNullOrWhiteSpace(customer.StripeCustomerId)
                    && !string.IsNullOrWhiteSpace(session.CustomerId)
                    && string.Equals(session.CustomerId, customer.StripeCustomerId, StringComparison.OrdinalIgnoreCase);
                trace.MetadataCustomerIdMatchesCaller =
                    int.TryParse(trace.MetadataCustomerId, out var mid) && mid == customerId;

                // Idempotency check.
                if (!string.IsNullOrWhiteSpace(session.PaymentIntentId))
                {
                    var existing = await _db.CustomerCreditTransactions
                        .Where(t => t.StripePaymentIntentId == session.PaymentIntentId)
                        .Select(t => new { t.CustomerId })
                        .FirstOrDefaultAsync();
                    if (existing != null)
                    {
                        trace.PaymentIntentAlreadyOnLedger = true;
                        trace.AlreadyAppliedToCustomerId = existing.CustomerId;
                    }
                }

                // Build the blocker list. ApplyBySessionId only blocks on (a) not paid,
                // (b) no PaymentIntent, (c) already on ledger. Metadata mismatches are
                // logged but allowed (operator-vouched override).
                if (!trace.SessionIsPaid)
                    trace.Blockers.Add($"Session payment_status='{session.PaymentStatus}' (not 'paid'). Apply requires paid.");
                if (string.IsNullOrWhiteSpace(session.PaymentIntentId))
                    trace.Blockers.Add("Session has no PaymentIntentId — cannot guarantee idempotency.");
                if (trace.PaymentIntentAlreadyOnLedger)
                {
                    trace.Blockers.Add(trace.AlreadyAppliedToCustomerId == customerId
                        ? $"This PaymentIntent is already on YOUR ledger (CustomerId={customerId}). Wallet already credited."
                        : $"This PaymentIntent is already on the ledger but under CustomerId={trace.AlreadyAppliedToCustomerId} — NOT this tenant. Cannot double-apply across tenants.");
                }

                trace.WouldApply = trace.Blockers.Count == 0;

                // Pick a human note. Prioritise actionable advice.
                if (trace.WouldApply)
                {
                    trace.Note = $"Ready to apply ${trace.AmountFromSession:0.00} to your wallet (CustomerId={customerId}). " +
                                 "Click 'Apply' on the panel — that calls ApplyBySessionId which will credit it now.";
                }
                else if (!trace.SessionIsPaid)
                {
                    trace.Note = $"Stripe says this session is '{session.PaymentStatus}'. Most likely the checkout was canceled / abandoned / expired. " +
                                 "Open the session in your Stripe Dashboard to confirm — if a charge actually went through, contact Stripe support.";
                }
                else if (trace.PaymentIntentAlreadyOnLedger && trace.AlreadyAppliedToCustomerId == customerId)
                {
                    trace.Note = "This payment IS already credited to your wallet. If the balance doesn't reflect it, your panel may be stale — refresh.";
                }
                else if (trace.PaymentIntentAlreadyOnLedger)
                {
                    trace.Note = $"This payment was credited to a DIFFERENT tenant (CustomerId={trace.AlreadyAppliedToCustomerId}). " +
                                 "That tenant got the money. You need to refund-and-retry, or have a superadmin transfer the balance.";
                }
                else
                {
                    trace.Note = string.Join(" · ", trace.Blockers);
                }

                _logger.LogInformation(
                    "TopUp trace: caller={CallerId} session={SessionId} mode={Mode} paid={Paid} intent={Intent} amountCents={Amt} pi={Pi} sessionCust={SCust} callerCust={CCust} stripeCustMatch={StripeMatch} metaCustMatch={MetaMatch} alreadyOnLedger={AOL}({AOLCust}) wouldApply={Would}",
                    customerId, trace.SessionId, trace.Mode, trace.SessionIsPaid,
                    trace.MetadataIntent, trace.AmountTotalCents, trace.PaymentIntentId,
                    trace.StripeCustomerIdOnSession, trace.CallerStripeCustomerId,
                    trace.StripeCustomerMatchesCaller, trace.MetadataCustomerIdMatchesCaller,
                    trace.PaymentIntentAlreadyOnLedger, trace.AlreadyAppliedToCustomerId,
                    trace.WouldApply);

                return ApiResponseFactory.Success(trace, trace.Note);
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex,
                    "Stripe error tracing session {SessionId} for caller {CallerId}",
                    trace.SessionId, customerId);
                trace.Blockers.Add($"Stripe error: {sex.Message}");
                trace.Note = trace.Blockers.Last();
                return ApiResponseFactory.Success(trace, trace.Note);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error tracing session {SessionId} for caller {CallerId}",
                    trace.SessionId, customerId);
                trace.Blockers.Add($"Internal error: {ex.Message}");
                trace.Note = trace.Blockers.Last();
                return ApiResponseFactory.Success(trace, trace.Note);
            }
        }

        /// <summary>
        /// Last-ditch manual recovery. The tenant pastes a Stripe Checkout Session ID
        /// for a payment the auto-scan couldn't find (typically: their Customer
        /// linkage is broken — payment was made under a different cus_*). We fetch
        /// the session, verify it's paid, derive the amount, and credit the CALLING
        /// tenant's wallet. The metadata.customer_id check is logged but not enforced
        /// — the operator vouches for the session by pasting its ID.
        /// </summary>
        public async Task<ApiResponse<bool>> ApplyCreditTopUpBySessionIdAsync(int customerId, string sessionId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.SecretKey))
                    return ApiResponseFactory.InternalError<bool>("Stripe is not configured.");
                if (string.IsNullOrWhiteSpace(sessionId))
                    return ApiResponseFactory.BadRequest<bool>("sessionId is required.");

                // Light defensive parse: a Checkout Session ID always starts with `cs_`.
                // We accept anything (Stripe will validate), but warn early on obvious
                // mistakes like pasting a payment_intent (`pi_…`) or charge (`ch_…`).
                var trimmedId = sessionId.Trim();
                if (!trimmedId.StartsWith("cs_", StringComparison.OrdinalIgnoreCase))
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        "That doesn't look like a Checkout Session ID. Session IDs start with 'cs_…'. " +
                        "From the Stripe Dashboard payment detail, the Checkout Session ID is on the right-hand side under 'Checkout summary'.");
                }

                var sessionSvc = new Stripe.Checkout.SessionService();
                Stripe.Checkout.Session session;
                try
                {
                    session = await sessionSvc.GetAsync(trimmedId);
                }
                catch (StripeException sex) when (sex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return ApiResponseFactory.NotFound<bool>(
                        "Stripe session not found. Check the ID, and confirm BackOffice and Stripe are in the same mode (test vs live).");
                }

                if (!string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        $"Session is not paid (payment_status={session.PaymentStatus}). Only paid sessions can be applied to the wallet.");
                }

                if (string.IsNullOrWhiteSpace(session.PaymentIntentId))
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        "Session has no PaymentIntentId — cannot guarantee idempotency. " +
                        "If this was an async payment, wait for it to finalize and try again.");
                }

                // Amount: prefer metadata.topup_amount if it's there and parseable,
                // else use session.AmountTotal (which Stripe stores in cents).
                decimal amount = 0;
                if (session.Metadata != null
                    && session.Metadata.TryGetValue("topup_amount", out var amtStr)
                    && decimal.TryParse(amtStr,
                        System.Globalization.NumberStyles.Number,
                        System.Globalization.CultureInfo.InvariantCulture,
                        out var fromMeta)
                    && fromMeta > 0)
                {
                    amount = fromMeta;
                }
                else if (session.AmountTotal.HasValue && session.AmountTotal.Value > 0)
                {
                    amount = session.AmountTotal.Value / 100m;
                }
                else
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        "Could not determine the top-up amount from the session (no metadata.topup_amount and no AmountTotal).");
                }

                // Log when we're overriding the metadata customer_id mismatch — this
                // is the whole reason this endpoint exists, but auditors need a trail.
                if (session.Metadata != null
                    && session.Metadata.TryGetValue("customer_id", out var midStr)
                    && int.TryParse(midStr, out var mid)
                    && mid != customerId)
                {
                    _logger.LogWarning(
                        "ManualApply override: caller={CallerId} applying session {SessionId} whose metadata.customer_id={MetaCustId}. " +
                        "Amount={Amount} pi={Pi}",
                        customerId, session.Id, midStr, amount, session.PaymentIntentId);
                }
                else
                {
                    _logger.LogInformation(
                        "ManualApply: caller={CallerId} applying session {SessionId} amount={Amount} pi={Pi}",
                        customerId, session.Id, amount, session.PaymentIntentId);
                }

                // Apply via the existing credit service. Idempotent on PaymentIntentId,
                // so a repeat click (or a delayed webhook) is a safe no-op.
                var apply = await _creditService.ApplyTopUpAsync(
                    customerId,
                    amount,
                    session.PaymentIntentId,
                    createdByUserId: null);

                if (!apply.IsSuccess)
                    return ApiResponseFactory.InternalError<bool>(apply.Message ?? "Apply failed.");

                return ApiResponseFactory.Success(true,
                    $"Applied ${amount:0.00} from session {session.Id} to your wallet.");
            }
            catch (StripeException sex)
            {
                _logger.LogError(sex,
                    "Stripe error in ApplyCreditTopUpBySessionIdAsync caller={CallerId} sessionId={SessionId}",
                    customerId, sessionId);
                return ApiResponseFactory.InternalError<bool>($"Stripe error: {sex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error in ApplyCreditTopUpBySessionIdAsync caller={CallerId} sessionId={SessionId}",
                    customerId, sessionId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        /// <summary>
        /// Apply a confirmed credit-topup checkout (mode=payment, intent="credit_topup").
        /// Dispatched from <c>ApplyCheckoutCompletedAsync</c> when session.Metadata says so.
        /// </summary>
        private async Task ApplyCreditTopUpCheckoutCompletedAsync(Stripe.Checkout.Session session)
        {
            _logger.LogInformation(
                "TOPUP_TRACE ApplyCreditTopUp ENTER sessionId={SessionId} paymentStatus={PaymentStatus} pi={Pi} sessionCust={SCust}",
                session.Id, session.PaymentStatus, session.PaymentIntentId, session.CustomerId);

            if (!string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("TOPUP_TRACE ApplyCreditTopUp SKIP_NOT_PAID sessionId={SessionId} paymentStatus={PaymentStatus}",
                    session.Id, session.PaymentStatus);
                return;
            }

            // Declare outside the chained `||` so the log statement below can
            // safely reference them — when `session.Metadata == null` short-
            // circuits the chain, TryGetValue never runs and these variables
            // would otherwise be unassigned (C# CS0165).
            string? customerIdStr = null;
            int customerId;
            if (session.Metadata == null
                || !session.Metadata.TryGetValue("customer_id", out customerIdStr)
                || !int.TryParse(customerIdStr, out customerId))
            {
                _logger.LogWarning("TOPUP_TRACE ApplyCreditTopUp SKIP_NO_CUSTOMER_ID sessionId={SessionId} metaCustId={Meta}",
                    session.Id, customerIdStr ?? "(missing)");
                return;
            }

            string? amountStr = null;
            decimal amount;
            if (!session.Metadata.TryGetValue("topup_amount", out amountStr)
                || !decimal.TryParse(amountStr,
                    System.Globalization.NumberStyles.Number,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out amount)
                || amount <= 0)
            {
                _logger.LogWarning("TOPUP_TRACE ApplyCreditTopUp SKIP_NO_TOPUP_AMOUNT sessionId={SessionId} metaAmount={Meta}",
                    session.Id, amountStr ?? "(missing)");
                return;
            }

            int? userId = null;
            if (session.Metadata.TryGetValue("requested_by_user_id", out var uidStr)
                && int.TryParse(uidStr, out var uid))
            {
                userId = uid;
            }

            // The Stripe PaymentIntent id is the natural idempotency key; the credit
            // service de-dupes on it. Session.PaymentIntentId is populated for mode=payment.
            var paymentIntentId = session.PaymentIntentId;
            if (string.IsNullOrWhiteSpace(paymentIntentId))
            {
                _logger.LogWarning("TOPUP_TRACE ApplyCreditTopUp SKIP_NO_PI sessionId={SessionId}", session.Id);
                return;
            }

            _logger.LogInformation(
                "TOPUP_TRACE ApplyCreditTopUp CALLING_APPLY sessionId={SessionId} customer={CustomerId} amount={Amount} pi={Pi}",
                session.Id, customerId, amount, paymentIntentId);

            var apply = await _creditService.ApplyTopUpAsync(customerId, amount, paymentIntentId, userId);
            if (!apply.IsSuccess)
            {
                _logger.LogError("Credit top-up apply failed customer={CustomerId} session={SessionId}: {Msg}",
                    customerId, session.Id, apply.Message);
            }
            else
            {
                _logger.LogInformation("Credit top-up applied customer={CustomerId} amount={Amount} session={SessionId}",
                    customerId, amount, session.Id);
            }
        }
    }
}
