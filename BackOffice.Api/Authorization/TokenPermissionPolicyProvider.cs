using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace BackOffice.Api.Authorization
{
    /// <summary>
    /// Custom policy provider that creates token permission policies dynamically.
    /// Usage: [Authorize(Policy = "TokenPermission:ViewItems")]
    /// This allows using any permission key as a policy name with the "TokenPermission:" prefix.
    /// </summary>
    public class TokenPermissionPolicyProvider : IAuthorizationPolicyProvider
    {
        private const string PolicyPrefix = "TokenPermission:";
        private readonly DefaultAuthorizationPolicyProvider _fallbackProvider;

        public TokenPermissionPolicyProvider(IOptions<AuthorizationOptions> options)
        {
            _fallbackProvider = new DefaultAuthorizationPolicyProvider(options);
        }

        public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
        {
            if (policyName.StartsWith(PolicyPrefix, StringComparison.OrdinalIgnoreCase))
            {
                var permissionKey = policyName.Substring(PolicyPrefix.Length);
                var policy = new AuthorizationPolicyBuilder()
                    .AddRequirements(new TokenPermissionRequirement(permissionKey))
                    .Build();

                return Task.FromResult<AuthorizationPolicy?>(policy);
            }

            return _fallbackProvider.GetPolicyAsync(policyName);
        }

        public Task<AuthorizationPolicy> GetDefaultPolicyAsync() =>
            _fallbackProvider.GetDefaultPolicyAsync();

        public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() =>
            _fallbackProvider.GetFallbackPolicyAsync();
    }
}
