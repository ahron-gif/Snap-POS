namespace BackOffice.Application.Interfaces.Payments
{
    /// <summary>
    /// Resolves the active payment adapter for a given tenant or explicit
    /// provider type. Register one factory in DI; register each concrete adapter
    /// (StripePaymentProvider, PayPalPaymentProvider, …) as <see cref="IPaymentProvider"/>
    /// implementations and let the factory pick by <see cref="IPaymentProvider.ProviderType"/>.
    ///
    /// Typical usage in a controller/service:
    /// <code>
    ///   var provider = await _factory.GetForCustomerAsync(customerId);
    ///   return await provider.CreateSubscribeSessionAsync(...);
    /// </code>
    /// </summary>
    public interface IPaymentProviderFactory
    {
        /// <summary>
        /// Resolve the provider configured for a specific tenant. Reads the tenant's
        /// stored <see cref="PaymentProviderType"/> (e.g. from Customer.PaymentProvider)
        /// and returns the matching <see cref="IPaymentProvider"/>.
        /// Throws if the tenant has no provider configured or the configured one isn't registered.
        /// </summary>
        Task<IPaymentProvider> GetForCustomerAsync(int customerId);

        /// <summary>
        /// Resolve an adapter by explicit type. Used by webhook controllers — the
        /// inbound webhook route (/webhooks/stripe) already tells us which adapter
        /// to dispatch to, so we don't need a tenant lookup.
        /// Throws if no adapter is registered for the given type.
        /// </summary>
        IPaymentProvider Get(PaymentProviderType type);

        /// <summary>Admin counterpart of <see cref="GetForCustomerAsync"/>.</summary>
        Task<IPaymentProviderAdmin> GetAdminForCustomerAsync(int customerId);

        /// <summary>Admin counterpart of <see cref="Get"/>.</summary>
        IPaymentProviderAdmin GetAdmin(PaymentProviderType type);
    }
}
