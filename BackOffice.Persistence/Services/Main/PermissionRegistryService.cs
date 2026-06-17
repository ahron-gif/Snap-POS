using AutoMapper;
using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Common.Permissions;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Reflection; 
using Module = BackOffice.Domain.Entities.Main.Module;

namespace BackOffice.Persistence.Services.Main
{ 
    public class PermissionRegistryService : IPermissionRegistryService
    {
        private readonly MainDBContext _dbContext;
        private readonly IMapper _mapper;
        private readonly ILogger<PermissionRegistryService> _logger;

        public PermissionRegistryService(
            MainDBContext dbContext,
            IMapper mapper,
            ILogger<PermissionRegistryService> logger)
        {
            _dbContext = dbContext;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<ApiResponse<List<ModuleTreeDto>>> GetModuleTreeAsync()
        {
            try
            {
                var allModules = await _dbContext.Modules
                    .Where(m => m.IsActive)
                    .OrderBy(m => m.SortOrder)
                    .Select(m => new ModuleTreeDto
                    {
                        ModuleId = m.ModuleId,
                        Code = m.Code ?? "",
                        ModuleName = m.ModuleName,
                        Icon = m.Icon,
                        SortOrder = m.SortOrder,
                        IsActive = m.IsActive,
                        ParentModuleId = m.ParentModuleId
                    }).ToListAsync();

                var allScreens = await _dbContext.Screens
                    .Where(s => s.IsActive)
                    .OrderBy(s => s.SortOrder)
                    .Select(s => new ScreenDto
                    {
                        Id = s.Id,
                        ModuleId = s.ModuleId,
                        Code = s.Code,
                        Name = s.Name,
                        Route = s.Route,
                        Icon = s.Icon,
                        SortOrder = s.SortOrder,
                        IsActive = s.IsActive
                    }).ToListAsync();

                // Build tree: attach screens to modules
                // Load all permissions and group by ScreenId
                var allPermissions = await _dbContext.Permissions
                    .Where(p => p.IsActive)
                    .OrderBy(p => p.SortOrder)
                    .Select(p => new { p.ScreenId, Dto = new PermissionDto
                    {
                        Id = p.Id,
                        ModuleId = p.ModuleId,
                        ScreenId = p.ScreenId ?? 0,
                        PermissionKey = p.PermissionKey,
                        Name = p.Name,
                        Category = p.Category,
                        SortOrder = p.SortOrder,
                        IsActive = p.IsActive
                    }}).ToListAsync();

                var permsByScreen = allPermissions
                    .Where(x => x.ScreenId.HasValue)
                    .GroupBy(x => x.ScreenId!.Value)
                    .ToDictionary(g => g.Key, g => g.Select(x => x.Dto).ToList());

                // Attach permissions to screens
                foreach (var screen in allScreens)
                {
                    if (permsByScreen.TryGetValue(screen.Id, out var perms))
                        screen.Permissions = perms;
                    else
                        screen.Permissions = new List<PermissionDto>();
                }

                var screensByModule = allScreens.GroupBy(s => s.ModuleId).ToDictionary(g => g.Key, g => g.ToList());
                foreach (var module in allModules)
                {
                    if (screensByModule.TryGetValue(module.ModuleId, out var screens))
                        module.Screens = screens; 
                }

                // Build tree: attach children to parents
                var moduleDict = allModules.ToDictionary(m => m.ModuleId);
                var rootModules = new List<ModuleTreeDto>();

                foreach (var module in allModules)
                {
                    if (module.ParentModuleId.HasValue && moduleDict.TryGetValue(module.ParentModuleId.Value, out var parent))
                    {
                        parent.Children.Add(module);
                    }
                    else
                    {
                        rootModules.Add(module);
                    }
                }

                return ApiResponseFactory.Success(rootModules);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching module tree");
                return ApiResponseFactory.InternalError<List<ModuleTreeDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<ModuleDto>> GetModuleByNameAsync(string moduleName)
        {
            try
            {
                var name = (moduleName ?? "").Trim();
                if (string.IsNullOrEmpty(name))
                    return ApiResponseFactory.BadRequest<ModuleDto>("Module name is required.");

                // Case-insensitive match so "Base Dashboard" matches "base dashboard" in DB
                var module = await _dbContext.Modules
                    .Where(m => m.IsActive && m.ModuleName != null && m.ModuleName.Trim().ToLower() == name.ToLower())
                    .Select(m => new ModuleDto
                    {
                        ModuleId = m.ModuleId,
                        Code = m.Code ?? "",
                        ModuleName = m.ModuleName,
                        Icon = m.Icon,
                        SortOrder = m.SortOrder,
                        IsActive = m.IsActive,
                        ParentModuleId = m.ParentModuleId
                    })
                    .FirstOrDefaultAsync();

                if (module == null)
                    return ApiResponseFactory.BadRequest<ModuleDto>($"Module not found with name '{name}'.");

                return ApiResponseFactory.Success(module);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting module by name");
                return ApiResponseFactory.InternalError<ModuleDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<List<ScreenDto>>> GetScreensByModuleAsync(int moduleId)
        {
            try
            {
                var screens = await (from s in _dbContext.Screens
                                    join m in _dbContext.Modules on s.ModuleId equals m.ModuleId
                                    where s.ModuleId == moduleId && s.IsActive
                                    orderby s.SortOrder
                                    select new ScreenDto
                                    {
                                        Id = s.Id,
                                        ModuleId = s.ModuleId,
                                        Code = s.Code,
                                        Name = s.Name,
                                        Route = s.Route,
                                        Icon = s.Icon,
                                        SortOrder = s.SortOrder,
                                        IsActive = s.IsActive,
                                        ModuleName = m.ModuleName
                                    }).ToListAsync();

                return ApiResponseFactory.Success(screens);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching screens for module {ModuleId}", moduleId);
                return ApiResponseFactory.InternalError<List<ScreenDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<List<PermissionDto>>> GetPermissionsByScreenAsync(int screenId)
        {
            try
            {
                var permissions = await (from p in _dbContext.Permissions
                                        join m in _dbContext.Modules on p.ModuleId equals m.ModuleId
                                        join s in _dbContext.Screens on p.ScreenId equals s.Id
                                        where p.ScreenId == screenId && p.IsActive
                                        orderby p.SortOrder
                                        select new PermissionDto
                                        {
                                            Id = p.Id,
                                            ModuleId = p.ModuleId,
                                            ScreenId = p.ScreenId ?? 0,
                                            PermissionKey = p.PermissionKey,
                                            Name = p.Name,
                                            Category = p.Category,
                                            SortOrder = p.SortOrder,
                                            IsActive = p.IsActive,
                                            ModuleName = m.ModuleName,
                                            ScreenName = s.Name
                                        }).ToListAsync();

                return ApiResponseFactory.Success(permissions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching permissions for screen {ScreenId}", screenId);
                return ApiResponseFactory.InternalError<List<PermissionDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<List<PermissionDto>>> GetAllPermissionsAsync()
        {
            try
            {
                var permissions = await (from p in _dbContext.Permissions
                                        join m in _dbContext.Modules on p.ModuleId equals m.ModuleId
                                        join s in _dbContext.Screens on p.ScreenId equals s.Id into screenJoin
                                        from s in screenJoin.DefaultIfEmpty()
                                        where p.IsActive
                                        orderby m.ModuleName, s.Name, p.SortOrder
                                        select new PermissionDto
                                        {
                                            Id = p.Id,
                                            ModuleId = p.ModuleId,
                                            ScreenId = p.ScreenId ?? 0,
                                            PermissionKey = p.PermissionKey,
                                            Name = p.Name,
                                            Category = p.Category,
                                            SortOrder = p.SortOrder,
                                            IsActive = p.IsActive,
                                            ModuleName = m.ModuleName,
                                            ScreenName = s != null ? s.Name : null
                                        }).ToListAsync();

                return ApiResponseFactory.Success(permissions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching all permissions");
                return ApiResponseFactory.InternalError<List<PermissionDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<int>> CreateScreenAsync(CreateScreenDto dto)
        {
            try
            {
                // ModuleId must exist in the Modules table (screen is added under that module)
                var moduleExists = await _dbContext.Modules.AnyAsync(m => m.ModuleId == dto.ModuleId);
                if (!moduleExists)
                    return ApiResponseFactory.BadRequest<int>($"Module with id {dto.ModuleId} not found. Screen must be added under an existing module from the Modules table.");

                var exists = await _dbContext.Screens
                    .AnyAsync(x => x.Code == dto.Code);
                if (exists)
                    return ApiResponseFactory.BadRequest<int>($"Screen with code '{dto.Code}' already exists.");

                var entity = new Screen
                {
                    ModuleId = dto.ModuleId,
                    Code = dto.Code,
                    Name = dto.Name,
                    Route = dto.Route,
                    Icon = dto.Icon,
                    SortOrder = dto.SortOrder,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Screens.Add(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.Id, "Screen created successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating screen");
                return ApiResponseFactory.InternalError<int>($"Error creating screen: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdateScreenAsync(UpdateScreenDto dto)
        {
            try
            {
                var entity = await _dbContext.Screens.FindAsync(dto.Id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Screen not found.");

                var code = (dto.Code ?? "").Trim();
                var name = (dto.Name ?? "").Trim();
                if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(name))
                    return ApiResponseFactory.BadRequest<bool>("Code and Name are required.");

                var duplicate = await _dbContext.Screens
                    .AnyAsync(x => x.Code == code && x.Id != dto.Id);
                if (duplicate)
                    return ApiResponseFactory.BadRequest<bool>($"Screen with code '{code}' already exists.");

                // Keep ModuleId from the existing entity (backend is source of truth); do not change module on update
                entity.Code = code;
                entity.Name = name;
                entity.Route = string.IsNullOrWhiteSpace(dto.Route) ? null : dto.Route.Trim();
                entity.Icon = string.IsNullOrWhiteSpace(dto.Icon) ? null : dto.Icon.Trim();
                entity.SortOrder = dto.SortOrder;
                entity.IsActive = dto.IsActive;
                entity.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Screen updated successfully.");
            }
            catch (DbUpdateException dbEx)
            {
                var inner = dbEx.InnerException?.Message ?? dbEx.Message;
                _logger.LogError(dbEx, "Error updating screen {Id}: {Inner}", dto.Id, inner);
                return ApiResponseFactory.InternalError<bool>($"Error updating screen: {inner}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating screen {Id}", dto.Id);
                return ApiResponseFactory.InternalError<bool>($"Error updating screen: {ex.Message}");
            }
        }

        public async Task<ApiResponse<int>> CreatePermissionAsync(CreatePermissionDto dto)
        {
            try
            {
                var exists = await _dbContext.Permissions
                    .AnyAsync(x => x.PermissionKey == dto.PermissionKey);
                if (exists)
                    return ApiResponseFactory.BadRequest<int>($"Permission with key '{dto.PermissionKey}' already exists.");

                var entity = new Permission
                {
                    ModuleId = dto.ModuleId,
                    ScreenId = dto.ScreenId,
                    PermissionKey = dto.PermissionKey,
                    Name = dto.Name,
                    Category = dto.Category ?? "action",
                    SortOrder = dto.SortOrder,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Permissions.Add(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.Id, "Permission created successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating permission");
                return ApiResponseFactory.InternalError<int>($"Error creating permission: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdatePermissionAsync(UpdatePermissionDto dto)
        {
            try
            {
                var entity = await _dbContext.Permissions.FindAsync(dto.Id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Permission not found.");

                var duplicate = await _dbContext.Permissions
                    .AnyAsync(x => x.PermissionKey == dto.PermissionKey && x.Id != dto.Id);
                if (duplicate)
                    return ApiResponseFactory.BadRequest<bool>($"Permission with key '{dto.PermissionKey}' already exists.");

                entity.ModuleId = dto.ModuleId;
                entity.ScreenId = dto.ScreenId;
                entity.PermissionKey = dto.PermissionKey;
                entity.Name = dto.Name;
                entity.Category = dto.Category ?? "action";
                entity.SortOrder = dto.SortOrder;
                entity.IsActive = dto.IsActive;
                entity.UpdatedAt = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Permission updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating permission {Id}", dto.Id);
                return ApiResponseFactory.InternalError<bool>($"Error updating permission: {ex.Message}");
            }
        }

        public async Task SeedPermissionsAsync()
        {
            try
            {
                // Collect all permission constant values from Perms static class using reflection
                var permissionKeys = new List<string>();
                CollectPermissionKeys(typeof(Perms), permissionKeys);

                // Load existing data for fast lookups
                var existingModules = await _dbContext.Modules
                    .Where(m => m.Code != null)
                    .ToDictionaryAsync(m => m.Code!, m => m);

                var existingScreens = await _dbContext.Screens
                    .ToDictionaryAsync(s => s.Code, s => s);

                var existingPermissions = await _dbContext.Permissions
                    .ToDictionaryAsync(p => p.PermissionKey, p => p);

                var sortOrder = 0;

                foreach (var key in permissionKeys)
                {
                    // Parse dot-notation: "sales.invoice.view" => module="sales", screen="sales.invoice", action="view"
                    var parts = key.Split('.');
                    if (parts.Length < 3) continue;

                    var moduleCode = parts[0];
                    var screenCode = $"{parts[0]}.{parts[1]}";
                    var action = parts[2];
                    var category = key.Contains(".field.") ? "field" : "action";

                    // Create Module if not exists
                    if (!existingModules.TryGetValue(moduleCode, out var module))
                    {
                        module = new Module
                        {
                            ModuleName = FormatDisplayName(moduleCode),
                            Code = moduleCode,
                            PageURL = "",
                            Icon = null,
                            SortOrder = existingModules.Count,
                            IsActive = true
                        };
                        _dbContext.Modules.Add(module);
                        await _dbContext.SaveChangesAsync();
                        existingModules[moduleCode] = module;
                    }

                    // Create Screen if not exists
                    if (!existingScreens.TryGetValue(screenCode, out var screen))
                    {
                        screen = new Screen
                        {
                            ModuleId = module.ModuleId,
                            Code = screenCode,
                            Name = FormatDisplayName(parts[1]),
                            Route = null,
                            Icon = null,
                            SortOrder = existingScreens.Count(s => s.Value.ModuleId == module.ModuleId),
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow
                        };
                        _dbContext.Screens.Add(screen);
                        await _dbContext.SaveChangesAsync();
                        existingScreens[screenCode] = screen;
                    }

                    // Create Permission if not exists
                    if (!existingPermissions.ContainsKey(key))
                    {
                        var permission = new Permission
                        {
                            ModuleId = module.ModuleId,
                            ScreenId = screen.Id,
                            PermissionKey = key,
                            Name = FormatDisplayName(action),
                            Category = category,
                            SortOrder = sortOrder++,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow
                        };
                        _dbContext.Permissions.Add(permission);
                        existingPermissions[key] = permission;
                    }
                }

                await _dbContext.SaveChangesAsync();
                _logger.LogInformation("Permission seeding completed. Processed {Count} permission keys.", permissionKeys.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding permissions from Perms constants");
                throw;
            }
        }

        /// <summary>
        /// Recursively collect all const string values from nested static classes within the given type.
        /// </summary>
        private static void CollectPermissionKeys(Type type, List<string> keys)
        {
            // Get all const string fields from this type
            var fields = type.GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
                .Where(f => f.IsLiteral && !f.IsInitOnly && f.FieldType == typeof(string));

            foreach (var field in fields)
            {
                var value = field.GetValue(null) as string;
                if (!string.IsNullOrEmpty(value))
                    keys.Add(value);
            }

            // Recurse into nested static classes
            foreach (var nestedType in type.GetNestedTypes(BindingFlags.Public | BindingFlags.Static))
            {
                CollectPermissionKeys(nestedType, keys);
            }
        }

        /// <summary>
        /// Converts a code like "purchase_order" or "invoice" to "Purchase Order" or "Invoice".
        /// </summary>
        private static string FormatDisplayName(string code)
        {
            if (string.IsNullOrEmpty(code)) return code;
            return string.Join(" ", code.Split('_', '-')
                .Select(word => char.ToUpper(word[0]) + word.Substring(1).ToLower()));
        }
    }
}
