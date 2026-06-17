namespace BackOffice.Application.Configuration
{
    public class StripeSettings
    {
        public const string SectionName = "Stripe";

        public string SecretKey { get; set; } = string.Empty;
        public string PublishableKey { get; set; } = string.Empty;
        public string WebhookSecret { get; set; } = string.Empty;

        // Frontend origin used to build success/cancel URLs for Checkout sessions.
        // e.g. "http://localhost:5173"
        public string FrontendBaseUrl { get; set; } = string.Empty;

        public string Currency { get; set; } = "usd";

        /// <summary>
        /// When true (default), the post-Checkout and post-ChangePlan flows pull the
        /// latest Stripe invoice and mirror it into our DB inline — guarantees the
        /// invoice appears in the UI without waiting for the webhook.
        ///
        /// In production with reliable webhooks you may set this to false to rely
        /// solely on invoice.* webhooks (saves one Stripe API call per checkout).
        /// Even when false, the mirror still runs from the webhook handler, so no
        /// data is lost — only the inline-mirror shortcut is disabled.
        /// </summary>
        public bool AutoMirrorInvoicesOnCheckout { get; set; } = true;

        /// <summary>
        /// Max seconds to wait when pulling the latest invoice inline after a Checkout
        /// or plan change. Keeps the user-facing request from hanging if Stripe's API
        /// is slow — falls back to the webhook (which has no such timeout) on expiry.
        /// </summary>
        public int InlineInvoiceFetchTimeoutSeconds { get; set; } = 8;
    }
}
