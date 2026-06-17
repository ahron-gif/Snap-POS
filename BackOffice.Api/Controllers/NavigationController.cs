using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Phase 3: Navigation and screen permission endpoints.
    /// Returns menu items and per-screen permission flags based on the user's effective permissions.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NavigationController : ControllerBase
    {
        private readonly IEffectivePermissionBuilder _permissionBuilder;
        private readonly MainDBContext _mainDb;
        private readonly ILogger<NavigationController> _logger;

        public NavigationController(
            IEffectivePermissionBuilder permissionBuilder,
            MainDBContext mainDb,
            ILogger<NavigationController> logger)
        {
            _permissionBuilder = permissionBuilder;
            _mainDb = mainDb;
            _logger = logger;
        }

        /// <summary>
        /// Returns the navigation menu filtered by the user's effective permissions.
        /// Only includes screens where the user has the ".view" permissions.
        /// </summary>
        [HttpGet("Menu")]
        public async Task<IActionResult> GetMenu()
        {
            try
            {
                var userId = GetUserIdFromClaims();
                var tenantId = GetTenantIdFromClaims();

                if (userId <= 0)
                    return Unauthorized();

                HashSet<string> effectivePerms;
                if (IsSuperAdminFromToken())
                {
                    effectivePerms = new HashSet<string>(
                        await _mainDb.Permissions
                            .Where(p => p.IsActive)
                            .Select(p => p.PermissionKey)
                            .ToListAsync());
                }
                else
                {
                    var result = await _permissionBuilder.BuildEffectivePermissionsAsync(userId, tenantId);
                    effectivePerms = result.Permissions;
                }

                // Load all active modules and screens
                var modules = await _mainDb.Modules
                    .Where(m => m.IsActive)
                    .OrderBy(m => m.SortOrder)
                    .ToListAsync();

                var screens = await _mainDb.Screens
                    .Where(s => s.IsActive)
                    .OrderBy(s => s.SortOrder)
                    .ToListAsync();

                // Filter screens: only include if user has <screenCode>.view permission
                var menuModules = new List<MenuModuleDto>();

                foreach (var module in modules)
                {
                    var moduleScreens = screens
                        .Where(s => s.ModuleId == module.ModuleId)
                        .Where(s =>
                        {
                            // Screen codes already contain the module prefix (e.g. "inventory.item_list")
                            // so we only append the action suffix
                            var viewKey = $"{s.Code}.view";
                            return effectivePerms.Contains(viewKey);
                        })
                        .Select(s => new MenuScreenDto
                        {
                            ScreenId = s.Id,
                            Code = s.Code,
                            Name = s.Name,
                            Route = s.Route,
                            Icon = s.Icon,
                            SortOrder = s.SortOrder
                        })
                        .ToList();

                    // Only include modules that have at least one visible screen
                    if (moduleScreens.Count > 0)
                    {
                        menuModules.Add(new MenuModuleDto
                        {
                            ModuleId = module.ModuleId,
                            Code = module.Code ?? string.Empty,
                            Name = module.ModuleName,
                            Icon = module.Icon,
                            SortOrder = module.SortOrder,
                            Screens = moduleScreens
                        });
                    }
                }

                var menu = new NavigationMenuDto { Modules = menuModules };
                return Ok(ApiResponseFactory.Success(menu));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error building navigation menu for user");
                return Ok(ApiResponseFactory.InternalError<NavigationMenuDto>(ex.Message));
            }
        }

        /// <summary>
        /// Returns permission flags for a specific screen (canView, canCreate, canEdit, etc.).
        /// The screenCode is the Screen.Code from the Master DB.
        /// Permission keys follow the pattern: {moduleCode}.{screenCode}.{action}
        /// </summary>
        [HttpGet("ScreenPermissions/{screenCode}")]
        public async Task<IActionResult> GetScreenPermissions(string screenCode)
        {
            try
            {
                var userId = GetUserIdFromClaims();
                var tenantId = GetTenantIdFromClaims();

                if (userId <= 0)
                    return Unauthorized();

                HashSet<string> effectivePerms;
                if (IsSuperAdminFromToken())
                {
                    effectivePerms = new HashSet<string>(
                        await _mainDb.Permissions
                            .Where(p => p.IsActive)
                            .Select(p => p.PermissionKey)
                            .ToListAsync());
                }
                else
                {
                    var result = await _permissionBuilder.BuildEffectivePermissionsAsync(userId, tenantId);
                    effectivePerms = result.Permissions;
                }

                // Find the screen and its module to build the permission key prefix
                var screen = await _mainDb.Screens
                    .Include(s => s.Module)
                    .FirstOrDefaultAsync(s => s.Code == screenCode && s.IsActive);

                if (screen == null)
                    return Ok(ApiResponseFactory.NotFound<ScreenPermissionsDto>($"Screen '{screenCode}' not found."));

                // Screen codes already contain the module prefix (e.g. "inventory.item_list")
                var prefix = $"{screen.Code}";

                // Check standard actions
                var dto = new ScreenPermissionsDto
                {
                    ScreenCode = screenCode,
                    CanView = effectivePerms.Contains($"{prefix}.view"),
                    CanCreate = effectivePerms.Contains($"{prefix}.create"),
                    CanEdit = effectivePerms.Contains($"{prefix}.edit"),
                    CanDelete = effectivePerms.Contains($"{prefix}.delete"),
                    CanApprove = effectivePerms.Contains($"{prefix}.approve"),
                    CanExport = effectivePerms.Contains($"{prefix}.export"),
                    CanImport = effectivePerms.Contains($"{prefix}.import"),
                    CanPrint = effectivePerms.Contains($"{prefix}.print"),
                    CanVoid = effectivePerms.Contains($"{prefix}.void"),
                    CanAssign = effectivePerms.Contains($"{prefix}.assign"),
                    CanConfig = effectivePerms.Contains($"{prefix}.config")
                };

                // Find any non-standard permission keys for this screen and add them to CustomActions
                var screenPerms = await _mainDb.Permissions
                    .Where(p => p.ScreenId == screen.Id && p.IsActive)
                    .Select(p => new { p.PermissionKey, p.Category })
                    .ToListAsync();

                var standardActions = new HashSet<string>
                {
                    "view", "create", "edit", "delete", "approve",
                    "export", "import", "print", "void", "assign", "config"
                };

                foreach (var perm in screenPerms)
                {
                    // Extract action from permission key (last segment)
                    var segments = perm.PermissionKey.Split('.');
                    var action = segments.Length > 0 ? segments[^1] : perm.PermissionKey;

                    if (!standardActions.Contains(action))
                    {
                        dto.CustomActions[action] = effectivePerms.Contains(perm.PermissionKey);
                    }
                }

                return Ok(ApiResponseFactory.Success(dto));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching screen permissions for {ScreenCode}", screenCode);
                return Ok(ApiResponseFactory.InternalError<ScreenPermissionsDto>(ex.Message));
            }
        }

        /// <summary>
        /// Returns all effective permission keys for the current user.
        /// Useful for client-side permission checks.
        /// </summary>
        [HttpGet("MyPermissions")]
        public async Task<IActionResult> GetMyPermissions()
        {
            try
            {
                var userId = GetUserIdFromClaims();
                var tenantId = GetTenantIdFromClaims();

                if (userId <= 0)
                    return Unauthorized();

                if (IsSuperAdminFromToken())
                {
                    var allKeys = await _mainDb.Permissions
                        .Where(p => p.IsActive)
                        .Select(p => p.PermissionKey)
                        .ToListAsync();

                    return Ok(ApiResponseFactory.Success(allKeys));
                }

                var result = await _permissionBuilder.BuildEffectivePermissionsAsync(userId, tenantId);
                var keys = result.Permissions.OrderBy(k => k).ToList();

                return Ok(ApiResponseFactory.Success(keys));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching permissions for current user");
                return Ok(ApiResponseFactory.InternalError<List<string>>(ex.Message));
            }
        }

        // ─── Private Helpers ──────────────────────────

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }

        private int GetTenantIdFromClaims()
        {
            var headerValue = HttpContext.Request.Headers["CustomerId"].ToString();
            if (!string.IsNullOrEmpty(headerValue) && int.TryParse(headerValue, out var headerCustomerId) && headerCustomerId > 0)
                return headerCustomerId;

            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            return int.TryParse(customerIdClaim, out var customerId) ? customerId : 0;
        }

        private bool IsSuperAdminFromToken()
        {
            // Primary signal: RoleType claim set by AuthService at login time.
            // Falls back to "CustomerId is empty/0" for older tokens issued before the
            // role-based path existed.
            var roleClaim = User.FindFirst("RoleType")?.Value;
            if (string.Equals(roleClaim, "SuperAdmin", StringComparison.OrdinalIgnoreCase))
                return true;

            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            return string.IsNullOrEmpty(customerIdClaim) || customerIdClaim == "0";
        }
    }
}
