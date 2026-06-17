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
    public class BillingService : IBillingService
    {
        private readonly MainDBContext _dbContext;
        private readonly ILogger<BillingService> _logger;

        public BillingService(
            MainDBContext dbContext,
            ILogger<BillingService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<ApiResponse<EstimatedBillDto>> CalculateEstimatedBillAsync(int customerId)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription).ThenInclude(s => s.Plan)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<EstimatedBillDto>("Customer not found.");

                // No plan assigned → return a graceful empty estimate rather than 400.
                // Callers (Licenses & Billing page, super-admin Customer Billing page) load
                // the estimate alongside the subscription via Promise.allSettled — surfacing
                // an empty estimate here lets the UI render a clean "no plan yet" state
                // without polluting the network tab with red 400s on every page load.
                if (customer.Subscription == null)
                {
                    var emptyEstimate = new EstimatedBillDto
                    {
                        CustomerId = customer.CustomerId,
                        CustomerName = customer.CustomerName,
                        PlanName = string.Empty,
                        BillingPeriodStart = DateTime.UtcNow.Date,
                        BillingPeriodEnd = DateTime.UtcNow.Date,
                        LineItems = new List<EstimatedBillLineDto>(),
                        SubTotal = 0m,
                        TaxRate = 0m,
                        TaxAmount = 0m,
                        TotalAmount = 0m
                    };
                    return ApiResponseFactory.Success(emptyEstimate, "Customer has no assigned plan; estimate is zero.");
                }

                var planId = customer.Subscription.PlanId;

                // Determine billing period
                var billingCycleMonths = customer.Subscription.BillingCycleMonths;
                var billingPeriodStart = customer.Subscription.StartDate ?? DateTime.UtcNow.Date;
                var billingPeriodEnd = billingPeriodStart.AddMonths(billingCycleMonths);

                // If the subscription start date is in the past, calculate the current billing period
                while (billingPeriodEnd <= DateTime.UtcNow)
                {
                    billingPeriodStart = billingPeriodEnd;
                    billingPeriodEnd = billingPeriodStart.AddMonths(billingCycleMonths);
                }

                // Load plan app pricings (App nav is ignored in EF config, load names separately)
                var planAppPricings = await _dbContext.PlanAppPricings
                    .Where(p => p.PlanId == planId && p.IsIncluded)
                    .ToListAsync();

                // Load app names separately
                var appIds = planAppPricings.Select(p => p.AppId).Distinct().ToList();
                var appNameMap = appIds.Count > 0
                    ? await _dbContext.Apps.Where(a => appIds.Contains(a.AppId)).ToDictionaryAsync(a => a.AppId, a => a.AppName)
                    : new Dictionary<int, string>();

                // Load customer apps for this customer
                var customerApps = await _dbContext.CustomerApps
                    .Where(ca => ca.CustomerId == customerId && ca.IsEnabled)
                    .ToListAsync();

                // Load licenses overlapping the current cycle. Device-days math:
                //   effStart = max(ActivatedAt, periodStart)
                //   effEnd   = min(BillingEndsAt ?? periodEnd, periodEnd)
                //   deviceDays = (effEnd - effStart).TotalDays  (clamped >= 0)
                var licenses = await _dbContext.CustomerAppLicenses
                    .Where(l => l.CustomerId == customerId
                        && !l.IsPlanBaseline
                        && l.ActivatedAt < billingPeriodEnd
                        && (l.BillingEndsAt == null || l.BillingEndsAt > billingPeriodStart))
                    .ToListAsync();
                var licensesByApp = licenses.GroupBy(l => l.AppId).ToDictionary(g => g.Key, g => g.ToList());

                var baselineCounts = await _dbContext.CustomerAppLicenses
                    .Where(l => l.CustomerId == customerId
                        && l.IsPlanBaseline
                        && l.BillingEndsAt == null)
                    .GroupBy(l => l.AppId)
                    .Select(g => new { AppId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.AppId, x => x.Count);

                var periodDays = (decimal)(billingPeriodEnd - billingPeriodStart).TotalDays;
                if (periodDays <= 0) periodDays = 1m; // defensive — never divide by zero

                // Load plan API pricings
                var planApiPricings = await _dbContext.PlanApiPricings
                    .Include(p => p.ApiDefinition)
                    .Where(p => p.PlanId == planId && p.IsIncluded)
                    .ToListAsync();

                // Load customer API overrides
                var customerApiOverrides = await _dbContext.CustomerApiOverrides
                    .Where(o => o.CustomerId == customerId && o.IsEnabled)
                    .ToListAsync();

                // Load API usage logs that overlap with the current billing period
                var apiUsageLogs = await _dbContext.ApiUsageLogs
                    .Where(l => l.CustomerId == customerId
                        && l.RecordedDate >= billingPeriodStart
                        && l.RecordedDate <= billingPeriodEnd)
                    .ToListAsync();

                // Load billing configs
                var billingConfigs = await _dbContext.BillingConfigs.ToListAsync();
                var configDict = billingConfigs.ToDictionary(c => c.ConfigKey, c => c.ConfigValue);

                var defaultTaxRate = decimal.TryParse(
                    configDict.GetValueOrDefault("default_tax_rate", "0"), out var taxRate) ? taxRate : 0m;
                var transactionRate = decimal.TryParse(
                    configDict.GetValueOrDefault("transaction_rate", "0"), out var txRate) ? txRate : 0m;
                var transactionFreeTier = int.TryParse(
                    configDict.GetValueOrDefault("transaction_free_tier", "0"), out var txFree) ? txFree : 0;

                var lineItems = new List<EstimatedBillLineDto>();

                // --- DEVICE LICENSES SECTION (device-days proration) ---
                foreach (var appPricing in planAppPricings)
                {
                    var customerApp = customerApps.FirstOrDefault(ca => ca.AppId == appPricing.AppId);

                    var pricePerUnit = customerApp?.PriceOverride ?? appPricing.PricePerUnit;
                    var freeUnits = customerApp?.FreeTierOverride ?? appPricing.FreeUnits;

                    var appLicenses = licensesByApp.GetValueOrDefault(appPricing.AppId, new List<CustomerAppLicense>());

                    decimal totalDeviceDays = 0m;
                    foreach (var lic in appLicenses)
                    {
                        var effStart = lic.ActivatedAt > billingPeriodStart ? lic.ActivatedAt : billingPeriodStart;
                        var rawEnd = lic.BillingEndsAt ?? billingPeriodEnd;
                        var effEnd = rawEnd < billingPeriodEnd ? rawEnd : billingPeriodEnd;
                        var span = (decimal)(effEnd - effStart).TotalDays;
                        if (span > 0) totalDeviceDays += span;
                    }

                    var freeDeviceDays = (decimal)freeUnits * periodDays;
                    var billableDeviceDays = Math.Max(0m, totalDeviceDays - freeDeviceDays);
                    // Fractional device-equivalents: 17 device-days / 30 cycle-days = 0.5667 paid devices
                    var billableUnits = Math.Round(billableDeviceDays / periodDays, 4);
                    var lineTotal = Math.Round(billableUnits * pricePerUnit, 2);

                    var addOnCount = appLicenses.Count(l => l.BillingEndsAt == null);
                    var baselineCount = baselineCounts.GetValueOrDefault(appPricing.AppId, 0);
                    var quantity = addOnCount + baselineCount;

                    var unitLabel = appPricing.PricingModel == "per_user" ? "users" : "devices";
                    var appName = appNameMap.GetValueOrDefault(appPricing.AppId, $"App {appPricing.AppId}");
                    var description = baselineCount > 0
                        ? $"{appName} - {quantity} {unitLabel} ({baselineCount} included + {addOnCount} add-on)"
                        : $"{appName} - {quantity} {unitLabel}";

                    lineItems.Add(new EstimatedBillLineDto
                    {
                        Description = description,
                        AppId = appPricing.AppId,
                        ApiDefinitionId = null,
                        Category = "device_license",
                        Quantity = quantity,
                        FreeUnits = freeUnits,
                        BillableUnits = billableUnits,
                        UnitPrice = pricePerUnit,
                        LineTotal = lineTotal
                    });
                }

                // --- API CALLS SECTION ---
                foreach (var apiPricing in planApiPricings)
                {
                    var apiOverride = customerApiOverrides
                        .FirstOrDefault(o => o.ApiDefinitionId == apiPricing.ApiDefinitionId);

                    var ratePerCall = apiOverride?.RateOverride ?? apiPricing.RatePerCall;
                    var freeTierCalls = apiOverride?.FreeTierOverride ?? apiPricing.FreeTierCalls;

                    var totalCalls = apiUsageLogs
                        .Where(l => l.ApiDefinitionId == apiPricing.ApiDefinitionId)
                        .Sum(l => l.CallCount);

                    var billableCalls = Math.Max(0, totalCalls - freeTierCalls);
                    var lineTotal = billableCalls * ratePerCall;

                    lineItems.Add(new EstimatedBillLineDto
                    {
                        Description = $"API Calls - {apiPricing.ApiDefinition.Name}",
                        AppId = null,
                        ApiDefinitionId = apiPricing.ApiDefinitionId,
                        Category = "api_calls",
                        Quantity = totalCalls,
                        FreeUnits = freeTierCalls,
                        BillableUnits = billableCalls,
                        UnitPrice = ratePerCall,
                        LineTotal = lineTotal
                    });
                }

                // --- TRANSACTIONS SECTION ---
                var transactionCount = await _dbContext.UsageRecords
                    .Where(u => u.CustomerId == customerId
                        && u.MetricType == "transaction"
                        && u.RecordedDate >= billingPeriodStart
                        && u.RecordedDate <= billingPeriodEnd)
                    .SumAsync(u => u.Count);

                var billableTransactions = Math.Max(0, transactionCount - transactionFreeTier);
                var transactionLineTotal = billableTransactions * transactionRate;

                if (transactionCount > 0 || transactionRate > 0)
                {
                    lineItems.Add(new EstimatedBillLineDto
                    {
                        Description = "Transaction Fees",
                        AppId = null,
                        ApiDefinitionId = null,
                        Category = "transaction",
                        Quantity = transactionCount,
                        FreeUnits = transactionFreeTier,
                        BillableUnits = billableTransactions,
                        UnitPrice = transactionRate,
                        LineTotal = transactionLineTotal
                    });
                }

                // --- TOTALS ---
                var subTotal = lineItems.Sum(l => l.LineTotal);
                var taxAmount = subTotal * (defaultTaxRate / 100m);
                var totalAmount = subTotal + taxAmount;

                var result = new EstimatedBillDto
                {
                    CustomerId = customer.CustomerId,
                    CustomerName = customer.CustomerName,
                    PlanName = customer.Subscription.Plan.Name,
                    BillingPeriodStart = billingPeriodStart,
                    BillingPeriodEnd = billingPeriodEnd,
                    LineItems = lineItems,
                    SubTotal = subTotal,
                    TaxRate = defaultTaxRate,
                    TaxAmount = taxAmount,
                    TotalAmount = totalAmount
                };

                return ApiResponseFactory.Success(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating estimated bill for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<EstimatedBillDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<InvoiceDetailDto>> GenerateInvoiceAsync(int customerId, DateTime billingPeriodStart, DateTime billingPeriodEnd)
        {
            try
            {
                var estimatedBillResponse = await CalculateEstimatedBillAsync(customerId);
                if (!estimatedBillResponse.IsSuccess || estimatedBillResponse.Response == null)
                    return ApiResponseFactory.BadRequest<InvoiceDetailDto>(
                        estimatedBillResponse.Message ?? "Failed to calculate estimated bill.");

                var estimatedBill = estimatedBillResponse.Response;

                // Generate invoice number
                var billingConfigs = await _dbContext.BillingConfigs.ToListAsync();
                var configDict = billingConfigs.ToDictionary(c => c.ConfigKey, c => c.ConfigValue);
                var invoicePrefix = configDict.GetValueOrDefault("invoice_prefix", "INV");

                var existingInvoiceCount = await _dbContext.Invoices.CountAsync();
                var nextNumber = existingInvoiceCount + 1;
                var invoiceNumber = $"{invoicePrefix}-{billingPeriodStart.Year}-{nextNumber:D6}";

                var invoice = new Invoice
                {
                    InvoiceNumber = invoiceNumber,
                    CustomerId = customerId,
                    BillingPeriodStart = billingPeriodStart,
                    BillingPeriodEnd = billingPeriodEnd,
                    IssuedAt = DateTime.UtcNow,
                    DueDate = billingPeriodEnd.AddDays(15),
                    SubTotal = estimatedBill.SubTotal,
                    TaxAmount = estimatedBill.TaxAmount,
                    TotalAmount = estimatedBill.TotalAmount,
                    Status = InvoiceStatus.Issued,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Invoices.Add(invoice);
                await _dbContext.SaveChangesAsync();

                // Create line items
                var lineItems = estimatedBill.LineItems.Select(li => new InvoiceLineItem
                {
                    InvoiceId = invoice.Id,
                    Description = li.Description,
                    AppId = li.AppId,
                    ApiDefinitionId = li.ApiDefinitionId,
                    Category = li.Category,
                    PricingModel = null,
                    Quantity = li.Quantity,
                    FreeUnits = li.FreeUnits,
                    BillableUnits = li.BillableUnits,
                    UnitPrice = li.UnitPrice,
                    LineTotal = li.LineTotal
                }).ToList();

                await _dbContext.InvoiceLineItems.AddRangeAsync(lineItems);
                await _dbContext.SaveChangesAsync();

                // Return the detail DTO
                var customer = await _dbContext.Customers
                    .Where(c => c.CustomerId == customerId)
                    .Select(c => c.CustomerName)
                    .FirstOrDefaultAsync();

                var result = new InvoiceDetailDto
                {
                    Id = invoice.Id,
                    InvoiceNumber = invoice.InvoiceNumber,
                    CustomerId = invoice.CustomerId,
                    CustomerName = customer,
                    BillingPeriodStart = invoice.BillingPeriodStart,
                    BillingPeriodEnd = invoice.BillingPeriodEnd,
                    IssuedAt = invoice.IssuedAt,
                    DueDate = invoice.DueDate,
                    TotalAmount = invoice.TotalAmount,
                    Status = invoice.Status,
                    PaidAt = invoice.PaidAt,
                    SubTotal = invoice.SubTotal,
                    TaxAmount = invoice.TaxAmount,
                    PaymentReference = invoice.PaymentReference,
                    Notes = invoice.Notes,
                    LineItems = lineItems.Select(li => new InvoiceLineItemDto
                    {
                        Id = li.Id,
                        Description = li.Description,
                        AppId = li.AppId,
                        ApiDefinitionId = li.ApiDefinitionId,
                        Category = li.Category,
                        PricingModel = li.PricingModel,
                        Quantity = li.Quantity,
                        FreeUnits = li.FreeUnits,
                        BillableUnits = li.BillableUnits,
                        UnitPrice = li.UnitPrice,
                        LineTotal = li.LineTotal
                    }).ToList()
                };

                return ApiResponseFactory.Success(result, "Invoice generated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating invoice for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<InvoiceDetailDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<List<InvoiceSummaryDto>>> GetInvoicesForCustomerAsync(int customerId)
        {
            try
            {
                var customer = await _dbContext.Customers.FindAsync(customerId);
                if (customer == null)
                    return ApiResponseFactory.NotFound<List<InvoiceSummaryDto>>("Customer not found.");

                var invoices = await _dbContext.Invoices
                    .Where(i => i.CustomerId == customerId)
                    .Select(i => new InvoiceSummaryDto
                    {
                        Id = i.Id,
                        InvoiceNumber = i.InvoiceNumber,
                        CustomerId = i.CustomerId,
                        CustomerName = i.Customer.CustomerName,
                        BillingPeriodStart = i.BillingPeriodStart,
                        BillingPeriodEnd = i.BillingPeriodEnd,
                        IssuedAt = i.IssuedAt,
                        DueDate = i.DueDate,
                        TotalAmount = i.TotalAmount,
                        Status = i.Status,
                        PaidAt = i.PaidAt,
                        HasStripeLink = i.HostedInvoiceUrl != null
                    }).ToListAsync();

                // Merge in credit-ledger movements (TopUp, Refund, AdminAdjustment) so
                // the Invoice History panel shows every payment source in one list —
                // not just subscription/addon invoices. Synthetic Ids are negated so
                // a frontend that hits /Invoices/{Id}/ViewLink with one will route to
                // the ledger handler below; the InvoiceNumber prefix lets the UI
                // colour-code them if it wants.
                var ledger = await _dbContext.CustomerCreditTransactions
                    .Where(t => t.CustomerId == customerId
                        && (t.Type == (int)CreditTransactionType.TopUp
                            || t.Type == (int)CreditTransactionType.Refund
                            || t.Type == (int)CreditTransactionType.AdminAdjustment))
                    .Select(t => new
                    {
                        t.Id,
                        t.Type,
                        t.Amount,
                        t.CreatedAt,
                        t.StripePaymentIntentId
                    })
                    .ToListAsync();

                foreach (var t in ledger)
                {
                    string prefix = t.Type switch
                    {
                        (int)CreditTransactionType.TopUp           => "TOPUP",
                        (int)CreditTransactionType.Refund          => "REFUND",
                        (int)CreditTransactionType.AdminAdjustment => t.Amount >= 0 ? "GRANT" : "DEBIT",
                        _                                          => "TXN"
                    };

                    var status = t.Type == (int)CreditTransactionType.Refund
                        ? InvoiceStatus.Refunded
                        : InvoiceStatus.Paid;

                    invoices.Add(new InvoiceSummaryDto
                    {
                        // Negative = ledger-backed (see GetInvoiceViewLinkAsync).
                        // Ledger Id is bigint but InvoiceSummaryDto.Id is int; cast is safe
                        // for any realistic transaction volume (int.MaxValue ≈ 2.1B rows).
                        Id = (int)(-t.Id),
                        InvoiceNumber = $"{prefix}-{t.Id:D5}",
                        CustomerId = customerId,
                        CustomerName = customer.CustomerName,
                        BillingPeriodStart = t.CreatedAt.Date,
                        BillingPeriodEnd = t.CreatedAt.Date,
                        IssuedAt = t.CreatedAt,
                        DueDate = t.CreatedAt.Date,
                        TotalAmount = t.Amount,
                        Status = status,
                        PaidAt = t.CreatedAt,
                        HasStripeLink = !string.IsNullOrWhiteSpace(t.StripePaymentIntentId)
                    });
                }

                // Sort newest first across both sources after the merge.
                invoices = invoices
                    .OrderByDescending(i => i.IssuedAt)
                    .ToList();

                return ApiResponseFactory.Success(invoices);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching invoices for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<List<InvoiceSummaryDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<InvoiceViewLinkDto>> GetInvoiceViewLinkAsync(int invoiceId, int callerCustomerId, bool isAdmin)
        {
            try
            {
                // Synthetic IDs returned by GetInvoicesForCustomerAsync for ledger rows
                // (TopUp / Refund / AdminAdjustment) come through negated. Resolve those
                // to a read-only "legacy" detail rendered directly from the ledger,
                // so the View button works for unified history entries too.
                if (invoiceId < 0)
                {
                    return await GetLedgerViewLinkAsync(-invoiceId, callerCustomerId, isAdmin);
                }

                var invoice = await _dbContext.Invoices
                    .Include(i => i.Customer)
                    .Include(i => i.LineItems)
                    .FirstOrDefaultAsync(i => i.Id == invoiceId);
                if (invoice == null)
                    return ApiResponseFactory.NotFound<InvoiceViewLinkDto>("Invoice not found.");

                // Tenant authorization: own invoices only. Admins skip this check.
                if (!isAdmin && invoice.CustomerId != callerCustomerId)
                    return ApiResponseFactory.Forbidden<InvoiceViewLinkDto>("Not your invoice.");

                var hasStripe = !string.IsNullOrWhiteSpace(invoice.HostedInvoiceUrl);

                var dto = new InvoiceViewLinkDto
                {
                    InvoiceId = invoice.Id,
                    IsLegacy = !hasStripe,
                    HostedInvoiceUrl = invoice.HostedInvoiceUrl,
                    InvoicePdfUrl = invoice.InvoicePdfUrl,
                    Detail = !hasStripe
                        ? new InvoiceDetailDto
                        {
                            Id = invoice.Id,
                            InvoiceNumber = invoice.InvoiceNumber,
                            CustomerId = invoice.CustomerId,
                            CustomerName = invoice.Customer?.CustomerName,
                            BillingPeriodStart = invoice.BillingPeriodStart,
                            BillingPeriodEnd = invoice.BillingPeriodEnd,
                            IssuedAt = invoice.IssuedAt,
                            DueDate = invoice.DueDate,
                            TotalAmount = invoice.TotalAmount,
                            SubTotal = invoice.SubTotal,
                            TaxAmount = invoice.TaxAmount,
                            Status = invoice.Status,
                            PaidAt = invoice.PaidAt,
                            PaymentReference = invoice.PaymentReference,
                            Notes = invoice.Notes,
                            LineItems = invoice.LineItems
                                .Select(li => new InvoiceLineItemDto
                                {
                                    Id = li.Id,
                                    Description = li.Description,
                                    AppId = li.AppId,
                                    ApiDefinitionId = li.ApiDefinitionId,
                                    Category = li.Category,
                                    PricingModel = li.PricingModel,
                                    Quantity = li.Quantity,
                                    FreeUnits = li.FreeUnits,
                                    BillableUnits = li.BillableUnits,
                                    UnitPrice = li.UnitPrice,
                                    LineTotal = li.LineTotal
                                }).ToList()
                        }
                        : null
                };

                return ApiResponseFactory.Success(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting invoice view link for {InvoiceId}", invoiceId);
                return ApiResponseFactory.InternalError<InvoiceViewLinkDto>(ex.Message);
            }
        }

        /// <summary>
        /// Build a read-only "legacy" InvoiceViewLink for a CustomerCreditTransactions
        /// row (TopUp / Refund / AdminAdjustment). Called by <see cref="GetInvoiceViewLinkAsync"/>
        /// when the caller passes a synthetic negative invoice id that maps to a ledger row.
        /// No Stripe-hosted URL exists for ledger rows; the View modal renders Detail.
        /// </summary>
        private async Task<ApiResponse<InvoiceViewLinkDto>> GetLedgerViewLinkAsync(long ledgerId, int callerCustomerId, bool isAdmin)
        {
            var txn = await _dbContext.CustomerCreditTransactions
                .Include(t => t.Customer)
                .Include(t => t.ApiDefinition)
                .FirstOrDefaultAsync(t => t.Id == ledgerId);
            if (txn == null)
                return ApiResponseFactory.NotFound<InvoiceViewLinkDto>("Credit ledger entry not found.");

            // Tenant authorization: own ledger only. Admins skip.
            if (!isAdmin && txn.CustomerId != callerCustomerId)
                return ApiResponseFactory.Forbidden<InvoiceViewLinkDto>("Not your transaction.");

            string prefix = txn.Type switch
            {
                (int)CreditTransactionType.TopUp           => "TOPUP",
                (int)CreditTransactionType.Refund          => "REFUND",
                (int)CreditTransactionType.AdminAdjustment => txn.Amount >= 0 ? "GRANT" : "DEBIT",
                _                                          => "TXN"
            };
            string category = txn.Type switch
            {
                (int)CreditTransactionType.TopUp           => "API Credit Top-up",
                (int)CreditTransactionType.Refund          => "API Credit Refund",
                (int)CreditTransactionType.AdminAdjustment => "Admin Adjustment",
                _                                          => "Credit Transaction"
            };
            var status = txn.Type == (int)CreditTransactionType.Refund
                ? InvoiceStatus.Refunded
                : InvoiceStatus.Paid;

            var detail = new InvoiceDetailDto
            {
                Id = (int)-ledgerId,
                InvoiceNumber = $"{prefix}-{ledgerId:D5}",
                CustomerId = txn.CustomerId,
                CustomerName = txn.Customer?.CustomerName,
                BillingPeriodStart = txn.CreatedAt.Date,
                BillingPeriodEnd = txn.CreatedAt.Date,
                IssuedAt = txn.CreatedAt,
                DueDate = txn.CreatedAt.Date,
                TotalAmount = txn.Amount,
                SubTotal = txn.Amount,
                TaxAmount = 0,
                Status = status,
                PaidAt = txn.CreatedAt,
                PaymentReference = txn.StripePaymentIntentId,
                Notes = txn.Description,
                LineItems = new List<InvoiceLineItemDto>
                {
                    new InvoiceLineItemDto
                    {
                        Id = 0,
                        Description = txn.Description ?? category,
                        ApiDefinitionId = txn.ApiDefinitionId,
                        Category = category,
                        PricingModel = "fixed",
                        Quantity = 1,
                        FreeUnits = 0,
                        BillableUnits = 1,
                        UnitPrice = txn.Amount,
                        LineTotal = txn.Amount
                    }
                }
            };

            return ApiResponseFactory.Success(new InvoiceViewLinkDto
            {
                InvoiceId = (int)-ledgerId,
                IsLegacy = true,            // no Stripe-hosted URL → frontend renders local modal
                HostedInvoiceUrl = null,
                InvoicePdfUrl = null,
                Detail = detail
            });
        }

        public async Task<ApiResponse<InvoiceDetailDto>> GetInvoiceByIdAsync(int invoiceId)
        {
            try
            {
                var invoice = await _dbContext.Invoices
                    .Include(i => i.Customer)
                    .Include(i => i.LineItems)
                    .Where(i => i.Id == invoiceId)
                    .Select(i => new InvoiceDetailDto
                    {
                        Id = i.Id,
                        InvoiceNumber = i.InvoiceNumber,
                        CustomerId = i.CustomerId,
                        CustomerName = i.Customer.CustomerName,
                        BillingPeriodStart = i.BillingPeriodStart,
                        BillingPeriodEnd = i.BillingPeriodEnd,
                        IssuedAt = i.IssuedAt,
                        DueDate = i.DueDate,
                        TotalAmount = i.TotalAmount,
                        Status = i.Status,
                        PaidAt = i.PaidAt,
                        SubTotal = i.SubTotal,
                        TaxAmount = i.TaxAmount,
                        PaymentReference = i.PaymentReference,
                        Notes = i.Notes,
                        LineItems = i.LineItems.Select(li => new InvoiceLineItemDto
                        {
                            Id = li.Id,
                            Description = li.Description,
                            AppId = li.AppId,
                            ApiDefinitionId = li.ApiDefinitionId,
                            Category = li.Category,
                            PricingModel = li.PricingModel,
                            Quantity = li.Quantity,
                            FreeUnits = li.FreeUnits,
                            BillableUnits = li.BillableUnits,
                            UnitPrice = li.UnitPrice,
                            LineTotal = li.LineTotal
                        }).ToList()
                    }).FirstOrDefaultAsync();

                if (invoice == null)
                    return ApiResponseFactory.NotFound<InvoiceDetailDto>("Invoice not found.");

                return ApiResponseFactory.Success(invoice);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching invoice {InvoiceId}", invoiceId);
                return ApiResponseFactory.InternalError<InvoiceDetailDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> MarkInvoicePaidAsync(int invoiceId, string? paymentReference)
        {
            try
            {
                var invoice = await _dbContext.Invoices.FindAsync(invoiceId);
                if (invoice == null)
                    return ApiResponseFactory.NotFound<bool>("Invoice not found.");

                if (invoice.Status == InvoiceStatus.Paid)
                    return ApiResponseFactory.BadRequest<bool>("Invoice is already marked as paid.");

                invoice.Status = InvoiceStatus.Paid;
                invoice.PaidAt = DateTime.UtcNow;
                invoice.PaymentReference = paymentReference;

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Invoice marked as paid.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking invoice {InvoiceId} as paid", invoiceId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> RecordPaymentAttemptAsync(int invoiceId, PaymentStatus status, string? failureReason)
        {
            try
            {
                var invoice = await _dbContext.Invoices.FindAsync(invoiceId);
                if (invoice == null)
                    return ApiResponseFactory.NotFound<bool>("Invoice not found.");

                var existingAttempts = await _dbContext.PaymentAttempts
                    .CountAsync(pa => pa.InvoiceId == invoiceId);
                var nextAttemptNumber = existingAttempts + 1;

                var paymentAttempt = new PaymentAttempt
                {
                    InvoiceId = invoiceId,
                    CustomerId = invoice.CustomerId,
                    AttemptedAt = DateTime.UtcNow,
                    Status = status,
                    FailureReason = failureReason,
                    Amount = invoice.TotalAmount,
                    AttemptNumber = nextAttemptNumber
                };

                _dbContext.PaymentAttempts.Add(paymentAttempt);

                if (status == PaymentStatus.Failed)
                {
                    invoice.Status = InvoiceStatus.PastDue;
                }
                else if (status == PaymentStatus.Success)
                {
                    invoice.Status = InvoiceStatus.Paid;
                    invoice.PaidAt = DateTime.UtcNow;
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Payment attempt recorded.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recording payment attempt for invoice {InvoiceId}", invoiceId);
                return ApiResponseFactory.InternalError<bool>(ex.Message);
            }
        }

        public async Task<ApiResponse<BillingStatusDto>> GetBillingStatusAsync(int customerId)
        {
            try
            {
                var customer = await _dbContext.Customers
                    .Include(c => c.Subscription).ThenInclude(s => s.Plan)
                    .FirstOrDefaultAsync(c => c.CustomerId == customerId);

                if (customer == null)
                    return ApiResponseFactory.NotFound<BillingStatusDto>("Customer not found.");

                var hasOverdueInvoices = await _dbContext.Invoices
                    .AnyAsync(i => i.CustomerId == customerId && i.Status == InvoiceStatus.PastDue);

                int? daysUntilSuspension = null;
                if (customer.Subscription?.GracePeriodEndsAt.HasValue == true && customer.Subscription.GracePeriodEndsAt > DateTime.UtcNow)
                {
                    daysUntilSuspension = (int)(customer.Subscription.GracePeriodEndsAt.Value - DateTime.UtcNow).TotalDays;
                }

                var result = new BillingStatusDto
                {
                    SubscriptionStatus = customer.Subscription?.Status ?? SubscriptionStatus.Active,
                    PlanName = customer.Subscription?.Plan?.Name,
                    GracePeriodEndsAt = customer.Subscription?.GracePeriodEndsAt,
                    SuspendedAt = customer.Subscription?.SuspendedAt,
                    IsOverdue = hasOverdueInvoices,
                    DaysUntilSuspension = daysUntilSuspension
                };

                return ApiResponseFactory.Success(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching billing status for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<BillingStatusDto>(ex.Message);
            }
        }
    }
}
