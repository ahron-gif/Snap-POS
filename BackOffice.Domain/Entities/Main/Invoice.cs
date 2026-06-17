#nullable enable
using System;
using System.Collections.Generic;
using BackOffice.Domain.Enums;

namespace BackOffice.Domain.Entities.Main;

public partial class Invoice
{
    public int Id { get; set; }

    public string InvoiceNumber { get; set; } = null!;

    public int CustomerId { get; set; }

    public DateTime BillingPeriodStart { get; set; }

    public DateTime BillingPeriodEnd { get; set; }

    public DateTime IssuedAt { get; set; }

    public DateTime DueDate { get; set; }

    public decimal SubTotal { get; set; }

    public decimal TaxAmount { get; set; }

    public decimal TotalAmount { get; set; }

    public InvoiceStatus Status { get; set; }

    public DateTime? PaidAt { get; set; }

    public string? PaymentReference { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    // ─── Stripe linkage (for "View Invoice" feature) ───

    public string? StripeInvoiceId { get; set; }

    public string? HostedInvoiceUrl { get; set; }

    public string? InvoicePdfUrl { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual ICollection<InvoiceLineItem> LineItems { get; set; } = new List<InvoiceLineItem>();

    public virtual ICollection<PaymentAttempt> PaymentAttempts { get; set; } = new List<PaymentAttempt>();
}
