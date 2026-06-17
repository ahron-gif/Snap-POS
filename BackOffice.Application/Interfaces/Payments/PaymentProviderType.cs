namespace BackOffice.Application.Interfaces.Payments
{
    /// <summary>
    /// Identifies which payment backend a customer/tenant is wired to. Persist
    /// this on the Customer/Subscription row so the right <see cref="IPaymentProvider"/>
    /// can be resolved at runtime via <see cref="IPaymentProviderFactory"/>.
    /// </summary>
    public enum PaymentProviderType
    {
        Stripe = 1,
        PayPal = 2,
        Square = 3,
        Manual = 99, // tenants billed outside any provider (offline invoices)
    }
}
