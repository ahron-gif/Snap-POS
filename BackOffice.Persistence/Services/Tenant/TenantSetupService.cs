using BackOffice.Application.DTOs.Tenant.Setup;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// Returns tenant-wide flags from the encrypted EncData blob, projecting
    /// just the safe-to-expose fields. Caches per-customer for 30 minutes —
    /// long enough to avoid hot-path decryption, short enough that license
    /// updates from the SuperAdmin UI eventually take effect even if the
    /// invalidation hook is missed. <see cref="LicenseService"/> calls
    /// <see cref="InvalidateCache"/> on save for immediate refresh.
    /// </summary>
    public sealed class TenantSetupService : ITenantSetupService
    {
        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(30);

        private readonly ILicenseService _licenseService;
        private readonly IMemoryCache _cache;
        private readonly ILogger<TenantSetupService> _logger;

        public TenantSetupService(
            ILicenseService licenseService,
            IMemoryCache cache,
            ILogger<TenantSetupService> logger)
        {
            _licenseService = licenseService;
            _cache = cache;
            _logger = logger;
        }

        public async Task<TenantSetupDto> GetSetupAsync(int customerId, CancellationToken ct = default)
        {
            var key = CacheKey(customerId);
            if (_cache.TryGetValue(key, out TenantSetupDto? cached) && cached is not null)
            {
                return cached;
            }

            var license = await _licenseService.GetLicenseAsync(customerId, ct);
            var dto = new TenantSetupDto
            {
                // If the tenant has no EncData row yet (rare — usually only on
                // brand-new installs), return null fields. The frontend will
                // treat null as "no opinion" and use safe defaults.
                StoreType         = license?.StoreType,
                Multiplelocation  = license?.Multiplelocation,
                AccountPayable    = license?.AccountPayable,
                Loyalty           = license?.Loyalty,
                PurchaseOrder     = license?.PurchaseOrder,
                SaleOrder         = license?.SaleOrder,
                PhoneOrder        = license?.PhoneOrder,
                Web               = license?.Web,
                Email             = license?.Email,
                PocketPC          = license?.PocketPC,
                ApproveCost       = license?.ApproveCost,
                ReorderWizard     = license?.ReorderWizard,
                RestockingWizard  = license?.RestockingWizard
            };

            _cache.Set(key, dto, CacheTtl);
            return dto;
        }

        public void InvalidateCache(int customerId)
        {
            _cache.Remove(CacheKey(customerId));
            _logger.LogDebug("TenantSetup cache invalidated for Customer {CustomerId}.", customerId);
        }

        private static string CacheKey(int customerId) => $"TenantSetup_{customerId}";
    }
}
