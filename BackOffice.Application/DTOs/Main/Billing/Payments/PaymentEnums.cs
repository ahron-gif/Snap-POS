namespace BackOffice.Application.DTOs.Main.Billing.Payments
{
    /// <summary>
    /// Provider-neutral proration policy when changing a subscription's plan.
    /// Each adapter maps this to its provider's native vocabulary
    /// (e.g. Stripe: create_prorations / none / always_invoice).
    /// </summary>
    public enum ProrationBehavior
    {
        /// <summary>Create proration line items on the next invoice (default).</summary>
        CreateProrations = 0,

        /// <summary>No proration — change takes effect with no immediate charge/credit.</summary>
        None = 1,

        /// <summary>Create proration line items and invoice them immediately.</summary>
        AlwaysInvoice = 2,
    }

    /// <summary>
    /// Provider-neutral pause-collection behavior. Each adapter maps this to
    /// its provider's native vocabulary (e.g. Stripe: keep_as_draft / mark_uncollectible / void).
    /// </summary>
    public enum PauseBehavior
    {
        /// <summary>Generate invoices but leave them as drafts (default).</summary>
        KeepAsDraft = 0,

        /// <summary>Generate invoices but mark them uncollectible.</summary>
        MarkUncollectible = 1,

        /// <summary>Void invoices entirely during the pause.</summary>
        Void = 2,
    }
}
