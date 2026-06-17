using BackOffice.Application.Interfaces.Payments;

namespace BackOffice.Application.DTOs.Main.Billing.Payments
{
    /// <summary>
    /// Provider-neutral view of a tenant's subscription state. Replaces the
    /// Stripe-prefixed fields on <c>AdminSubscriptionDetailDto</c> with generic
    /// "provider-side" identifiers, so the same shape works for Stripe, PayPal, etc.
    ///
    /// Adapters fill <see cref="ProviderType"/> and the <c>Provider*</c> fields with
    /// their own backend's identifiers.
    /// </summary>
    public class SubscriptionDetailDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;

        // ─── Provider identity ──────────────────────────────────────────
        public PaymentProviderType ProviderType { get; set; }
        public string? ProviderCustomerId { get; set; }
        public string? ProviderSubscriptionId { get; set; }

        /// <summary>Raw, provider-side status string (e.g. Stripe: active/past_due/paused).</summary>
        public string? ProviderStatus { get; set; }

        // ─── Plan ───────────────────────────────────────────────────────
        public int PlanId { get; set; }
        public string PlanName { get; set; } = string.Empty;
        public decimal MonthlyAmount { get; set; }

        /// <summary>Domain-side status string (our normalized vocabulary).</summary>
        public string Status { get; set; } = string.Empty;

        // ─── Billing cycle ──────────────────────────────────────────────
        public DateTime? CurrentPeriodStart { get; set; }
        public DateTime? CurrentPeriodEnd { get; set; }
        public bool CancelAtPeriodEnd { get; set; }
        public DateTime? CanceledAt { get; set; }
        public PauseBehavior? PauseBehavior { get; set; }

        // ─── Payment method ─────────────────────────────────────────────
        public string? DefaultPaymentMethodId { get; set; }
        public string? DefaultPaymentMethodBrand { get; set; }
        public string? DefaultPaymentMethodLast4 { get; set; }

        public DateTime? LastPaymentAt { get; set; }
        public bool IsPaid { get; set; }
    }
}
