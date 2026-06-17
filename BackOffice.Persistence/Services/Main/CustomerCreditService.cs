using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Enums;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    /// <summary>
    /// Default <see cref="ICustomerCreditService"/>. The check-and-record path
    /// delegates to <c>sp_CustomerCredit_CheckAndRecordApiCall</c> for atomic
    /// concurrency-safe behaviour. Top-up / admin-adjust paths use EF Core
    /// transactions plus the optimistic concurrency token on CustomerCredit.
    /// </summary>
    public class CustomerCreditService : ICustomerCreditService
    {
        private const string CheckAndRecordSpName = "dbo.sp_CustomerCredit_CheckAndRecordApiCall";

        private readonly MainDBContext _db;
        private readonly ILogger<CustomerCreditService> _logger;

        public CustomerCreditService(MainDBContext db, ILogger<CustomerCreditService> logger)
        {
            _db = db;
            _logger = logger;
        }

        // ─── Balance + free-tier snapshot ──────────────────────────────────

        public async Task<ApiResponse<CreditBalanceDto>> GetBalanceAsync(int customerId)
        {
            try
            {
                var wallet = await EnsureWalletAsync(customerId);

                // Per-API consumption snapshot. The same overrides/plan-pricing
                // logic the stored proc uses, evaluated in C# for read-only display.
                var subPlanId = await _db.Subscriptions
                    .Where(s => s.CustomerId == customerId)
                    .Select(s => (int?)s.PlanId)
                    .FirstOrDefaultAsync();

                var apis = await _db.ApiDefinitions
                    .Where(a => a.IsActive)
                    .OrderBy(a => a.SortOrder)
                    .Select(a => new
                    {
                        a.Id,
                        a.Code,
                        a.Name,
                        a.DefaultFreeTier,
                        a.DefaultRatePerCall
                    })
                    .ToListAsync();

                var overrides = await _db.CustomerApiOverrides
                    .Where(o => o.CustomerId == customerId && o.IsEnabled)
                    .ToListAsync();

                var planPricing = subPlanId.HasValue
                    ? await _db.PlanApiPricings
                        .Where(p => p.PlanId == subPlanId.Value)
                        .ToListAsync()
                    : new List<PlanApiPricing>();

                var today = DateTime.UtcNow.Date;
                var monthStart = new DateTime(today.Year, today.Month, 1);
                var monthEnd = monthStart.AddMonths(1);

                var perApi = new List<ApiFreeTierSnapshotDto>(apis.Count);
                foreach (var api in apis)
                {
                    var o = overrides.FirstOrDefault(x => x.ApiDefinitionId == api.Id);
                    var pp = planPricing.FirstOrDefault(x => x.ApiDefinitionId == api.Id);

                    var freeTier = o?.FreeTierOverride ?? api.DefaultFreeTier;
                    var rate = o?.RateOverride ?? pp?.RatePerCall ?? api.DefaultRatePerCall;

                    var used = await _db.ApiUsageLogs
                        .Where(u => u.CustomerId == customerId && u.ApiDefinitionId == api.Id)
                        .SumAsync(u => (int?)u.CallCount) ?? 0;

                    var thisMonth = await _db.ApiUsageLogs
                        .Where(u => u.CustomerId == customerId
                            && u.ApiDefinitionId == api.Id
                            && u.RecordedDate >= monthStart
                            && u.RecordedDate < monthEnd)
                        .SumAsync(u => (int?)u.CallCount) ?? 0;

                    perApi.Add(new ApiFreeTierSnapshotDto
                    {
                        ApiDefinitionId = api.Id,
                        ApiCode = api.Code,
                        ApiName = api.Name,
                        FreeTierLimit = freeTier,
                        CallsUsed = used,
                        CallsThisMonth = thisMonth,
                        FreeRemaining = Math.Max(0, freeTier - used),
                        EffectiveRate = rate
                    });
                }

                return ApiResponseFactory.Success(new CreditBalanceDto
                {
                    CustomerId = customerId,
                    Balance = wallet.Balance,
                    Currency = wallet.Currency,
                    LastTopUpAt = wallet.LastTopUpAt,
                    LastTopUpAmount = wallet.LastTopUpAmount,
                    PerApi = perApi
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetBalanceAsync failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CreditBalanceDto>(ex.Message);
            }
        }

        // ─── Atomic check + record ──────────────────────────────────────────

        public async Task<ApiResponse<CheckAndRecordResultDto>> CheckAndRecordApiCallAsync(
            int customerId, string apiCode, int callCount)
        {
            if (string.IsNullOrWhiteSpace(apiCode))
                return ApiResponseFactory.BadRequest<CheckAndRecordResultDto>("apiCode is required.");
            if (callCount <= 0) callCount = 1;

            try
            {
                // Raw ADO is cleaner than EF here because the proc returns a one-row
                // result set with a mix of types; mapping into a DTO via Dapper-style
                // is ergonomic and avoids EF having to track an unrelated entity type.
                using var conn = (SqlConnection)_db.Database.GetDbConnection();
                var ownsConnection = conn.State != System.Data.ConnectionState.Open;
                if (ownsConnection) await conn.OpenAsync();

                try
                {
                    using var cmd = conn.CreateCommand();
                    cmd.CommandType = System.Data.CommandType.StoredProcedure;
                    cmd.CommandText = CheckAndRecordSpName;
                    cmd.Parameters.Add(new SqlParameter("@CustomerId", customerId));
                    cmd.Parameters.Add(new SqlParameter("@ApiCode", apiCode));
                    cmd.Parameters.Add(new SqlParameter("@CallCount", callCount));

                    using var reader = await cmd.ExecuteReaderAsync();
                    if (!await reader.ReadAsync())
                    {
                        return ApiResponseFactory.InternalError<CheckAndRecordResultDto>(
                            "CheckAndRecord proc returned no row.");
                    }

                    var result = new CheckAndRecordResultDto
                    {
                        Allowed = reader.GetBoolean(reader.GetOrdinal("Allowed")),
                        Reason = await SafeGetStringAsync(reader, "Reason"),
                        BalanceAfter = reader.GetDecimal(reader.GetOrdinal("BalanceAfter")),
                        FreeRemaining = reader.GetInt32(reader.GetOrdinal("FreeRemaining")),
                        BillableCalls = reader.GetInt32(reader.GetOrdinal("BillableCalls")),
                        Cost = reader.GetDecimal(reader.GetOrdinal("Cost"))
                    };

                    return ApiResponseFactory.Success(result);
                }
                finally
                {
                    if (ownsConnection) await conn.CloseAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "CheckAndRecordApiCallAsync failed for customer {CustomerId} code {ApiCode}",
                    customerId, apiCode);
                return ApiResponseFactory.InternalError<CheckAndRecordResultDto>(ex.Message);
            }
        }

        private static async Task<string?> SafeGetStringAsync(SqlDataReader reader, string column)
        {
            var i = reader.GetOrdinal(column);
            if (await reader.IsDBNullAsync(i)) return null;
            return reader.GetString(i);
        }

        // ─── Top-up (Stripe-confirmed) ──────────────────────────────────────

        public async Task<ApiResponse<CreditBalanceDto>> ApplyTopUpAsync(
            int customerId, decimal amount, string stripePaymentIntentId, int? createdByUserId)
        {
            _logger.LogInformation(
                "TOPUP_TRACE ApplyTopUpAsync ENTER customer={CustomerId} amount={Amount} pi={Pi} createdBy={CreatedBy}",
                customerId, amount, stripePaymentIntentId, createdByUserId);

            if (amount <= 0)
            {
                _logger.LogWarning("TOPUP_TRACE ApplyTopUpAsync REJECT customer={CustomerId} reason=amount_must_be_positive amount={Amount}", customerId, amount);
                return ApiResponseFactory.BadRequest<CreditBalanceDto>("amount must be positive.");
            }
            if (string.IsNullOrWhiteSpace(stripePaymentIntentId))
            {
                _logger.LogWarning("TOPUP_TRACE ApplyTopUpAsync REJECT customer={CustomerId} reason=missing_payment_intent_id", customerId);
                return ApiResponseFactory.BadRequest<CreditBalanceDto>("stripePaymentIntentId is required.");
            }

            try
            {
                // Idempotency: a duplicate webhook delivery has the same PaymentIntentId.
                var existingForPi = await _db.CustomerCreditTransactions
                    .Where(t => t.StripePaymentIntentId == stripePaymentIntentId)
                    .Select(t => new { t.CustomerId, t.Amount, t.BalanceAfter })
                    .FirstOrDefaultAsync();
                if (existingForPi != null)
                {
                    _logger.LogWarning(
                        "TOPUP_TRACE ApplyTopUpAsync ALREADY_APPLIED caller={CustomerId} appliedTo={AppliedTo} amount={Amount} balanceAfter={Balance} pi={Pi}",
                        customerId, existingForPi.CustomerId, existingForPi.Amount, existingForPi.BalanceAfter, stripePaymentIntentId);
                    return await GetBalanceAsync(customerId);
                }

                using var tx = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

                var wallet = await EnsureWalletAsync(customerId);
                wallet.Balance += amount;
                wallet.UpdatedAt = DateTime.UtcNow;
                wallet.LastTopUpAt = DateTime.UtcNow;
                wallet.LastTopUpAmount = amount;

                _db.CustomerCreditTransactions.Add(new CustomerCreditTransaction
                {
                    CustomerId = customerId,
                    Type = (int)CreditTransactionType.TopUp,
                    Amount = amount,
                    BalanceAfter = wallet.Balance,
                    StripePaymentIntentId = stripePaymentIntentId,
                    Description = $"Stripe top-up {amount:0.00} {wallet.Currency}",
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = createdByUserId
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                _logger.LogInformation(
                    "TOPUP_TRACE ApplyTopUpAsync APPLIED customer={CustomerId} amount={Amount} pi={Pi} balanceAfter={Balance}",
                    customerId, amount, stripePaymentIntentId, wallet.Balance);

                return await GetBalanceAsync(customerId);
            }
            catch (DbUpdateException dx) when (dx.InnerException is SqlException se && se.Number == 2601)
            {
                // 2601 = unique-index violation. Concurrent webhook delivery hit the
                // PaymentIntent dedup index between our read and write. Treat as success.
                _logger.LogWarning("TOPUP_TRACE ApplyTopUpAsync IDEMPOTENCY_RACE customer={CustomerId} pi={Pi}", customerId, stripePaymentIntentId);
                return await GetBalanceAsync(customerId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TOPUP_TRACE ApplyTopUpAsync ERROR customer={CustomerId} pi={Pi} msg={Msg}", customerId, stripePaymentIntentId, ex.Message);
                return ApiResponseFactory.InternalError<CreditBalanceDto>(ex.Message);
            }
        }

        // ─── Superadmin manual adjustment ──────────────────────────────────

        public async Task<ApiResponse<CreditBalanceDto>> AdminAdjustAsync(
            int customerId, decimal amount, string description, int adminUserId)
        {
            if (amount == 0)
                return ApiResponseFactory.BadRequest<CreditBalanceDto>("amount must be non-zero.");
            if (string.IsNullOrWhiteSpace(description))
                return ApiResponseFactory.BadRequest<CreditBalanceDto>("description is required.");

            try
            {
                using var tx = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

                var wallet = await EnsureWalletAsync(customerId);
                var newBalance = wallet.Balance + amount;
                if (newBalance < 0)
                    return ApiResponseFactory.BadRequest<CreditBalanceDto>(
                        $"Adjustment would drive balance below zero (would be {newBalance:0.0000}).");

                wallet.Balance = newBalance;
                wallet.UpdatedAt = DateTime.UtcNow;

                _db.CustomerCreditTransactions.Add(new CustomerCreditTransaction
                {
                    CustomerId = customerId,
                    Type = (int)CreditTransactionType.AdminAdjustment,
                    Amount = amount,
                    BalanceAfter = wallet.Balance,
                    Description = description,
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = adminUserId
                });

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                _logger.LogInformation(
                    "Admin adjustment customer={CustomerId} amount={Amount} by user={UserId} balance={Balance}",
                    customerId, amount, adminUserId, wallet.Balance);

                return await GetBalanceAsync(customerId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AdminAdjustAsync failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<CreditBalanceDto>(ex.Message);
            }
        }

        // ─── Ledger ────────────────────────────────────────────────────────

        public async Task<ApiResponse<PagedCreditTransactionsDto>> GetTransactionsAsync(
            int customerId, int page, int pageSize)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 200) pageSize = 50;

            try
            {
                var query = _db.CustomerCreditTransactions
                    .Where(t => t.CustomerId == customerId)
                    .OrderByDescending(t => t.CreatedAt)
                    .Select(t => new
                    {
                        t.Id, t.CustomerId, t.Type, t.Amount, t.BalanceAfter,
                        t.CallCount, t.StripePaymentIntentId, t.Description,
                        t.CreatedAt, t.CreatedByUserId,
                        ApiCode = t.ApiDefinition != null ? t.ApiDefinition.Code : null
                    });

                var total = await query.CountAsync();

                var rows = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                var items = rows.Select(t => new CreditTransactionDto
                {
                    Id = t.Id,
                    CustomerId = t.CustomerId,
                    Type = t.Type,
                    TypeLabel = ((CreditTransactionType)t.Type).ToString(),
                    Amount = t.Amount,
                    BalanceAfter = t.BalanceAfter,
                    ApiCode = t.ApiCode,
                    CallCount = t.CallCount,
                    StripePaymentIntentId = t.StripePaymentIntentId,
                    Description = t.Description,
                    CreatedAt = t.CreatedAt,
                    CreatedByUserId = t.CreatedByUserId
                }).ToList();

                return ApiResponseFactory.Success(new PagedCreditTransactionsDto
                {
                    Items = items,
                    Page = page,
                    PageSize = pageSize,
                    Total = total
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetTransactionsAsync failed for customer {CustomerId}", customerId);
                return ApiResponseFactory.InternalError<PagedCreditTransactionsDto>(ex.Message);
            }
        }

        // ─── Helpers ───────────────────────────────────────────────────────

        /// <summary>Returns the wallet, creating a zero-balance row if needed (covers
        /// customers created after the migration backfill).</summary>
        private async Task<CustomerCredit> EnsureWalletAsync(int customerId)
        {
            var wallet = await _db.CustomerCredits
                .FirstOrDefaultAsync(c => c.CustomerId == customerId);

            if (wallet == null)
            {
                wallet = new CustomerCredit
                {
                    CustomerId = customerId,
                    Balance = 0m,
                    Currency = "USD",
                    CreatedAt = DateTime.UtcNow
                };
                _db.CustomerCredits.Add(wallet);
                await _db.SaveChangesAsync();
            }

            return wallet;
        }
    }
}
