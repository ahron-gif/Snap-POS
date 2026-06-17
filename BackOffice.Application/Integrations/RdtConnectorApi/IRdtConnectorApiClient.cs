namespace BackOffice.Application.Integrations.RdtConnectorApi
{
    public interface IRdtConnectorApiClient
    {
        /// <summary>
        /// Invalidate cache entries in the RDT Connector API for the given token.
        /// </summary>
        /// <param name="token">The Guid token string (cache key identifier).</param>
        /// <param name="cacheTypes">Cache types to invalidate: "StoreToken", "TokenPermissions", "TokenStoreAccess".</param>
        Task InvalidateCacheAsync(string token, params string[] cacheTypes);
    }
}
