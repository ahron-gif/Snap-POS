using BackOffice.Domain.Enums;

namespace BackOffice.Application.DTOs.Main.Billing
{
    public class InvoiceSummaryDto
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = null!;
        public int CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public DateTime BillingPeriodStart { get; set; }
        public DateTime BillingPeriodEnd { get; set; }
        public DateTime IssuedAt { get; set; }
        public DateTime DueDate { get; set; }
        public decimal TotalAmount { get; set; }
        public InvoiceStatus Status { get; set; }
        public DateTime? PaidAt { get; set; }
        public bool HasStripeLink { get; set; }
    }

    /// <summary>
    /// Returned by /Invoice/{id}/ViewLink. Frontend opens HostedInvoiceUrl if present,
    /// otherwise falls back to a local read-only modal rendered from Detail.
    /// </summary>
    public class InvoiceViewLinkDto
    {
        public int InvoiceId { get; set; }
        public bool IsLegacy { get; set; }     // true → no Stripe URL → render modal from Detail
        public string? HostedInvoiceUrl { get; set; }
        public string? InvoicePdfUrl { get; set; }
        public InvoiceDetailDto? Detail { get; set; }
    }

    public class InvoiceDetailDto
    {
        public int Id { get; set; }
        public string InvoiceNumber { get; set; } = null!;
        public int CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public DateTime BillingPeriodStart { get; set; }
        public DateTime BillingPeriodEnd { get; set; }
        public DateTime IssuedAt { get; set; }
        public DateTime DueDate { get; set; }
        public decimal TotalAmount { get; set; }
        public InvoiceStatus Status { get; set; }
        public DateTime? PaidAt { get; set; }
        public decimal SubTotal { get; set; }
        public decimal TaxAmount { get; set; }
        public string? PaymentReference { get; set; }
        public string? Notes { get; set; }
        public List<InvoiceLineItemDto> LineItems { get; set; } = new();
    }

    public class InvoiceLineItemDto
    {
        public int Id { get; set; }
        public string Description { get; set; } = null!;
        public int? AppId { get; set; }
        public int? ApiDefinitionId { get; set; }
        public string Category { get; set; } = null!;
        public string? PricingModel { get; set; }
        public int Quantity { get; set; }
        public int FreeUnits { get; set; }
        public decimal BillableUnits { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
    }

    public class PaymentAttemptDto
    {
        public int Id { get; set; }
        public int InvoiceId { get; set; }
        public DateTime AttemptedAt { get; set; }
        public PaymentStatus Status { get; set; }
        public string? FailureReason { get; set; }
        public string? PaymentProvider { get; set; }
        public decimal Amount { get; set; }
        public int AttemptNumber { get; set; }
    }
}
