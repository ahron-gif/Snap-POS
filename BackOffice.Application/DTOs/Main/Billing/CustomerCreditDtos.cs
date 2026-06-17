using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Main.Billing
{
    /// <summary>Wallet snapshot returned by GET /api/CustomerCredit/MyBalance.</summary>
    public class CreditBalanceDto
    {
        public int CustomerId { get; set; }
        public decimal Balance { get; set; }
        public string Currency { get; set; } = "USD";
        public DateTime? LastTopUpAt { get; set; }
        public decimal? LastTopUpAmount { get; set; }
        public List<ApiFreeTierSnapshotDto> PerApi { get; set; } = new();
    }

    /// <summary>Per-(customer, ApiDefinition) free-tier consumption snapshot used by the
    /// "API Credits &amp; Usage" panel to render usage progress bars + monthly activity.</summary>
    public class ApiFreeTierSnapshotDto
    {
        public int ApiDefinitionId { get; set; }
        public string ApiCode { get; set; } = "";
        public string ApiName { get; set; } = "";
        public int FreeTierLimit { get; set; }

        /// <summary>Lifetime calls consumed against the one-time free grant.</summary>
        public int CallsUsed { get; set; }

        /// <summary>Calls in the current calendar month (informational — not used in the free-tier calculation).</summary>
        public int CallsThisMonth { get; set; }

        public int FreeRemaining { get; set; }
        public decimal EffectiveRate { get; set; }
    }

    /// <summary>One ledger row (TopUp / ApiDeduction / Refund / AdminAdjustment).</summary>
    public class CreditTransactionDto
    {
        public long Id { get; set; }
        public int CustomerId { get; set; }
        public int Type { get; set; }
        public string TypeLabel { get; set; } = "";
        public decimal Amount { get; set; }
        public decimal BalanceAfter { get; set; }
        public string? ApiCode { get; set; }
        public int? CallCount { get; set; }
        public string? StripePaymentIntentId { get; set; }
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? CreatedByUserId { get; set; }
    }

    public class PagedCreditTransactionsDto
    {
        public List<CreditTransactionDto> Items { get; set; } = new();
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }
    }

    // ─── CheckAndRecord (called from the Connector API per metered call) ────

    public class CheckAndRecordApiCallDto
    {
        public string ApiCode { get; set; } = "";
        public int CallCount { get; set; } = 1;
    }

    public class CheckAndRecordResultDto
    {
        public bool Allowed { get; set; }
        public string? Reason { get; set; }
        public decimal BalanceAfter { get; set; }
        public int FreeRemaining { get; set; }
        public int BillableCalls { get; set; }
        public decimal Cost { get; set; }
    }

    // ─── Top-up (tenant initiates a Stripe Checkout) ───────────────────────

    public class TopUpRequestDto
    {
        /// <summary>USD; allowed range enforced server-side: 5 .. 5000.</summary>
        public decimal Amount { get; set; }
    }

    // ─── Superadmin manual adjustment ───────────────────────────────────────

    public class AdminAdjustCreditDto
    {
        /// <summary>Signed amount. Positive = grant, negative = revoke.</summary>
        public decimal Amount { get; set; }
        public string Description { get; set; } = "";
    }

    // ─── Trace (per-session dry-run diagnostic) ─────────────────────────────

    /// <summary>
    /// Full dry-run trace of a Stripe Checkout Session: what Stripe sees, what
    /// BackOffice sees, whether the linkage matches, whether the PaymentIntent
    /// is already on the ledger, and a definitive "would this Apply succeed?"
    /// verdict with a blocker list. Driven by POST /api/CustomerCredit/TopUp/Trace.
    /// </summary>
    public class CreditTopUpTraceDto
    {
        // ─── Stripe session ───
        public bool SessionFound { get; set; }
        public string SessionId { get; set; } = "";
        public string? Mode { get; set; }
        public string? PaymentStatus { get; set; }
        public string? StripeCustomerIdOnSession { get; set; }
        public string? PaymentIntentId { get; set; }
        public long? AmountTotalCents { get; set; }
        public decimal? AmountFromSession { get; set; }
        public string? MetadataIntent { get; set; }
        public string? MetadataCustomerId { get; set; }
        public string? MetadataTopUpAmount { get; set; }

        // ─── Caller (BackOffice tenant) ───
        public int CallerCustomerId { get; set; }
        public string? CallerStripeCustomerId { get; set; }

        // ─── Match analysis ───
        public bool SessionIsPaid { get; set; }
        public bool IntentIsCreditTopUp { get; set; }
        public bool StripeCustomerMatchesCaller { get; set; }
        public bool MetadataCustomerIdMatchesCaller { get; set; }

        // ─── Idempotency ───
        public bool PaymentIntentAlreadyOnLedger { get; set; }
        public int? AlreadyAppliedToCustomerId { get; set; }

        // ─── Verdict ───
        public bool WouldApply { get; set; }
        public List<string> Blockers { get; set; } = new();
        public string Note { get; set; } = "";
    }

    // ─── Stripe customer linkage ────────────────────────────────────────────

    /// <summary>
    /// Result of <c>EnsureStripeCustomerAsync</c>. Tells the caller whether a
    /// Stripe customer was found / linked / freshly created.
    /// </summary>
    public class EnsureStripeCustomerResultDto
    {
        /// <summary>Stripe customer id (cus_…) after the call. Always populated on success.</summary>
        public string StripeCustomerId { get; set; } = "";

        /// <summary>How the link was resolved: "already_linked", "found_orphan", or "created".</summary>
        public string Source { get; set; } = "";
    }

    // ─── Recovery diagnostic ────────────────────────────────────────────────

    /// <summary>
    /// Result of <c>RecoverPendingCreditTopUpsAsync</c>. Counters let the panel show
    /// exactly why a tenant's "paid in Stripe but $0 wallet" situation is the way
    /// it is (no Stripe customer linked, no credit_topup sessions at all, payments
    /// still pending, etc.).
    /// </summary>
    public class CreditTopUpRecoveryResultDto
    {
        public int Scanned { get; set; }
        public int Applied { get; set; }
        public int SkippedNotCreditTopUp { get; set; }
        public int SkippedNotPaid { get; set; }
        public int SkippedCustomerMismatch { get; set; }
        public int SkippedNoPaymentIntent { get; set; }
        public int AlreadyApplied { get; set; }
        public bool HasStripeCustomer { get; set; }
        public string? Note { get; set; }
    }
}
