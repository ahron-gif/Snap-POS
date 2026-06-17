using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BackOffice.Api.Authorization
{
    /// <summary>
    /// Action filter that checks the user's effective permissions against a required permission key.
    /// Instantiated via RequirePermissionAttribute (TypeFilterAttribute).
    /// </summary>
    public class PermissionAuthorizationFilter : IAsyncActionFilter
    {
        private readonly string _permissionKey;
        private readonly IEffectivePermissionBuilder _permissionBuilder;
        private readonly ILogger<PermissionAuthorizationFilter> _logger;

        public PermissionAuthorizationFilter(
            string permissionKey,
            IEffectivePermissionBuilder permissionBuilder,
            ILogger<PermissionAuthorizationFilter> logger)
        {
            _permissionKey = permissionKey;
            _permissionBuilder = permissionBuilder;
            _logger = logger;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var user = context.HttpContext.User;

            // Extract userId and customerId (tenantId) from JWT claims
            var userIdClaim = user.FindFirst("UserId")?.Value;
            var customerIdClaim = user.FindFirst("CustomerId")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            {
                _logger.LogWarning("Permission check failed: no valid UserId claim for permission {PermissionKey}", _permissionKey);
                context.Result = new JsonResult(
                    ApiResponseFactory.Forbidden<object>($"You do not have permission: {_permissionKey}"))
                {
                    StatusCode = 403
                };
                return;
            }

            if (string.IsNullOrEmpty(customerIdClaim) || !int.TryParse(customerIdClaim, out var tenantId) || tenantId <= 0)
            {
                // No tenant context -- super admin or no tenant; allow through
                await next();
                return;
            }

            try
            {
                var effectivePerms = await _permissionBuilder.BuildEffectivePermissionsAsync(userId, tenantId);

                if (!effectivePerms.Permissions.Contains(_permissionKey))
                {
                    _logger.LogWarning(
                        "Permission denied: User {UserId} in tenant {TenantId} does not have permission {PermissionKey}",
                        userId, tenantId, _permissionKey);

                    context.Result = new JsonResult(
                        ApiResponseFactory.Forbidden<object>($"You do not have permission: {_permissionKey}"))
                    {
                        StatusCode = 403
                    };
                    return;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking permission {PermissionKey} for user {UserId}", _permissionKey, userId);
                // Fail-open on error to prevent outages; log for investigation
            }

            await next();
        }
    }
}
