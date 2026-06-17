using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.StoreToken;
using BackOffice.Application.DTOs.SmartKartReg.TokenPermission;
using BackOffice.Application.DTOs.SmartKartReg.TokenStoreAccess;
using BackOffice.Application.Helpers;
using BackOffice.Application.Integrations.RdtConnectorApi;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Domain.Entities.Tenant;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Serilog;
using SmartKartReg.Infrastructure.DBContext;
using ILogger = Serilog.ILogger;
using Task = System.Threading.Tasks.Task;

namespace BackOffice.Persistence.Services.SmartKartReg
{
    public class StoreTokenService : IStoreTokenService
    {
        private static readonly ILogger Logger = Log.ForContext<StoreTokenService>();

        private readonly RegistrationDbContext _dbContext;
        private readonly IRdtConnectorApiClient _connectorApiClient;
        private readonly ITenantDbContextFactory _tenantDbContextFactory;

        public StoreTokenService(RegistrationDbContext dbContext, IRdtConnectorApiClient connectorApiClient, ITenantDbContextFactory tenantDbContextFactory)
        {
            _dbContext = dbContext;
            _connectorApiClient = connectorApiClient;
            _tenantDbContextFactory = tenantDbContextFactory;
        }

        public ApiResponse<PaginationResponseDTO<StoreTokenGridDto>> GetAllTokensGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                // Join StoreTokens with Registration to get StoreName directly
                var query = _dbContext.StoreTokens
                    .Join(
                        _dbContext.Registrations,
                        st => st.RegistrationId,
                        r => r.RegistrationId,
                        (st, r) => new StoreTokenGridDto
                        {
                            Id = st.Id,
                            Token = st.Token,
                            RegistrationId = st.RegistrationId,
                            StoreApp = st.StoreApp,
                            StoreName = r.StoreName,
                            Active = st.Active,
                            DateCreated = st.DateCreated,
                            DateModified = st.DateModified
                        })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.StoreTokens.Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "DateCreated", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<StoreTokenGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Tokens retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<StoreTokenGridDto>>(
                    "Error fetching tokens.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<StoreTokenDropdownDto>>> GetTokensDropdownAsync()
        {
            try
            {
                var tokens = await _dbContext.StoreTokens
                    .Join(
                        _dbContext.Registrations,
                        st => st.RegistrationId,
                        r => r.RegistrationId,
                        (st, r) => new StoreTokenDropdownDto
                        {
                            Id = st.Id,
                            RegistrationId = st.RegistrationId,
                            StoreApp = st.StoreApp,
                            StoreName = r.StoreName,
                            Active = st.Active
                        })
                    .OrderBy(x => x.StoreApp)
                    .ThenBy(x => x.StoreName)
                    .ToListAsync();

                return ApiResponseFactory.Success(tokens, "Tokens dropdown retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<StoreTokenDropdownDto>>(
                    $"Error fetching tokens dropdown: {ex.Message}");
            }
        }

        public async Task<ApiResponse<StoreTokenDetailDto>> GetTokenByIdAsync(int id)
        {
            try
            {
                var token = await _dbContext.StoreTokens
                    .Where(x => x.Id == id)
                    .Join(
                        _dbContext.Registrations,
                        st => st.RegistrationId,
                        r => r.RegistrationId,
                        (st, r) => new StoreTokenDetailDto
                        {
                            Id = st.Id,
                            Token = st.Token,
                            RegistrationId = st.RegistrationId,
                            StoreApp = st.StoreApp,
                            StoreName = r.StoreName,
                            Active = st.Active,
                            DateCreated = st.DateCreated,
                            DateModified = st.DateModified,
                            CreatedBy = st.CreatedBy,
                            ModifiedBy = st.ModifiedBy
                        })
                    .FirstOrDefaultAsync();

                if (token == null)
                {
                    return ApiResponseFactory.NotFound<StoreTokenDetailDto>("Token not found.");
                }

                return ApiResponseFactory.Success(token, "Token retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<StoreTokenDetailDto>(
                    $"Error fetching token: {ex.Message}");
            }
        }

        public async Task<ApiResponse<int>> CreateTokenAsync(CreateStoreTokenDto dto, string createdBy)
        {
            try
            {
                var entity = new global::SmartKartReg.Infrastructure.Entities.StoreToken
                {
                    Token = Guid.NewGuid(),
                    RegistrationId = dto.RegistrationId,
                    StoreApp = dto.StoreApp,
                    Active = dto.Active,
                    DateCreated = DateTime.UtcNow,
                    CreatedBy = createdBy
                };

                _dbContext.StoreTokens.Add(entity);
                await _dbContext.SaveChangesAsync();

                // Invalidate StoreToken cache (new token for this registration)
                await InvalidateCacheSafe(entity.Token.ToString(), "StoreToken");

                return ApiResponseFactory.Success(entity.Id, "Token created successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<int>(
                    $"Error creating token: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdateTokenAsync(UpdateStoreTokenDto dto, string modifiedBy)
        {
            try
            {
                var entity = await _dbContext.StoreTokens.FindAsync(dto.Id);
                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Token not found.");
                }

                var tokenGuid = entity.Token.ToString();

                entity.RegistrationId = dto.RegistrationId;
                entity.StoreApp = dto.StoreApp;
                entity.Active = dto.Active;
                entity.DateModified = DateTime.UtcNow;
                entity.ModifiedBy = modifiedBy;

                await _dbContext.SaveChangesAsync();

                // Invalidate all cache types for this token (Active status, registration, etc. may have changed)
                await InvalidateCacheSafe(tokenGuid, "StoreToken", "TokenPermissions", "TokenStoreAccess");

                return ApiResponseFactory.Success(true, "Token updated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error updating token: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteTokenAsync(int id)
        {
            try
            {
                var entity = await _dbContext.StoreTokens.FindAsync(id);
                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Token not found.");
                }

                // Check if token has permission mappings
                var hasPermissions = await _dbContext.TokenPermissions
                    .AnyAsync(x => x.TokenId == id);

                if (hasPermissions)
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        "Cannot delete token. It has permission mappings. Remove the token-permission mappings first.");
                }

                // Check if token has store access mappings
                var hasStoreAccess = await _dbContext.TokenStoreAccesses
                    .AnyAsync(x => x.TokenId == id);

                if (hasStoreAccess)
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        "Cannot delete token. It has store access mappings. Remove the store access mappings first.");
                }

                var tokenGuid = entity.Token.ToString();

                _dbContext.StoreTokens.Remove(entity);
                await _dbContext.SaveChangesAsync();

                // Invalidate all cache types for deleted token
                await InvalidateCacheSafe(tokenGuid, "StoreToken", "TokenPermissions", "TokenStoreAccess");

                return ApiResponseFactory.Success(true, "Token deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error deleting token: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<TokenPermissionGridDto>>> GetTokenPermissionsAsync(int tokenId)
        {
            try
            {
                // First check if token exists
                var tokenExists = await _dbContext.StoreTokens.AnyAsync(x => x.Id == tokenId);
                if (!tokenExists)
                {
                    return ApiResponseFactory.NotFound<List<TokenPermissionGridDto>>("Token not found.");
                }

                var permissions = await _dbContext.TokenPermissions
                    .Where(x => x.TokenId == tokenId)
                    .Include(x => x.Permission)
                    .Select(x => new TokenPermissionGridDto
                    {
                        Id = x.Id,
                        TokenId = x.TokenId,
                        PermissionId = x.PermissionId,
                        PermissionKey = x.Permission.PermissionKey,
                        PermissionName = x.Permission.PermissionName,
                        IsAllowed = x.IsAllowed,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified
                    })
                    .OrderBy(x => x.PermissionName)
                    .ToListAsync();

                return ApiResponseFactory.Success(permissions, "Token permissions retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<TokenPermissionGridDto>>(
                    $"Error fetching token permissions: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> BulkUpdateTokenPermissionsAsync(int tokenId, BulkTokenPermissionUpdateDto dto, string modifiedBy)
        {
            try
            {
                // Validate token exists
                var tokenEntity = await _dbContext.StoreTokens
                    .Where(x => x.Id == tokenId)
                    .Select(x => new { x.Id, x.Token })
                    .FirstOrDefaultAsync();

                if (tokenEntity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Token not found.");
                }

                if (dto.Permissions == null || dto.Permissions.Count == 0)
                {
                    return ApiResponseFactory.BadRequest<bool>("No permissions provided.");
                }

                // Validate all permission IDs exist
                var permissionIds = dto.Permissions.Select(p => p.PermissionId).Distinct().ToList();
                var existingPermissionIds = await _dbContext.Permissions
                    .Where(p => permissionIds.Contains(p.Id))
                    .Select(p => p.Id)
                    .ToListAsync();

                var missingIds = permissionIds.Except(existingPermissionIds).ToList();
                if (missingIds.Any())
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        $"Permission IDs not found: {string.Join(", ", missingIds)}");
                }

                // Get existing token-permission mappings for this token
                var existingMappings = await _dbContext.TokenPermissions
                    .Where(x => x.TokenId == tokenId)
                    .ToListAsync();

                var now = DateTime.UtcNow;

                foreach (var item in dto.Permissions)
                {
                    var existing = existingMappings.FirstOrDefault(m => m.PermissionId == item.PermissionId);

                    if (existing != null)
                    {
                        // Update existing mapping
                        existing.IsAllowed = item.IsAllowed;
                        existing.DateModified = now;
                        existing.ModifiedBy = modifiedBy;
                    }
                    else
                    {
                        // Create new mapping
                        _dbContext.TokenPermissions.Add(new global::SmartKartReg.Infrastructure.Entities.TokenPermission
                        {
                            TokenId = tokenId,
                            PermissionId = item.PermissionId,
                            IsAllowed = item.IsAllowed,
                            DateCreated = now,
                            CreatedBy = modifiedBy
                        });
                    }
                }

                await _dbContext.SaveChangesAsync();

                // Invalidate permissions cache for this token
                await InvalidateCacheSafe(tokenEntity.Token.ToString(), "TokenPermissions");

                return ApiResponseFactory.Success(true, "Token permissions updated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error bulk updating token permissions: {ex.Message}");
            }
        }

        // ==================== Token Store Access ====================

        public async Task<ApiResponse<List<TokenStoreAccessGridDto>>> GetTokenStoreAccessAsync(int tokenId)
        {
            try
            {
                var tokenWithRegistration = await (
                    from st in _dbContext.StoreTokens
                    join r in _dbContext.Registrations on st.RegistrationId equals r.RegistrationId
                    where st.Id == tokenId
                    select new
                    {
                        st.StoreApp,
                        r.ServerName,
                        r.DataBaseName,
                        r.UserName,
                        r.Password
                    })
                    .FirstOrDefaultAsync();

                if (tokenWithRegistration == null)
                {
                    return ApiResponseFactory.NotFound<List<TokenStoreAccessGridDto>>("Token not found.");
                }

                var storeAccessEntries = await _dbContext.TokenStoreAccesses
                    .Where(tsa => tsa.TokenId == tokenId)
                    .OrderBy(tsa => tsa.DateCreated)
                    .ToListAsync();

                if (storeAccessEntries.Count == 0)
                {
                    return ApiResponseFactory.Success(new List<TokenStoreAccessGridDto>(), "Token store access retrieved successfully.");
                }

                var storeNameMap = new Dictionary<Guid, string>();

                if (!string.IsNullOrWhiteSpace(tokenWithRegistration.ServerName) &&
                    !string.IsNullOrWhiteSpace(tokenWithRegistration.DataBaseName))
                {
                    try
                    {
                        await using var tenantDb = _tenantDbContextFactory.CreateForCustomer(
                            tokenWithRegistration.ServerName,
                            tokenWithRegistration.DataBaseName,
                            tokenWithRegistration.UserName,
                            tokenWithRegistration.Password);

                        var storeIds = storeAccessEntries.Select(e => e.StoreId).ToList();
                        storeNameMap = await tenantDb.Set<Store>()
                            .Where(s => storeIds.Contains(s.StoreID))
                            .ToDictionaryAsync(s => s.StoreID, s => s.StoreName ?? string.Empty);
                    }
                    catch (Exception ex)
                    {
                        Logger.Warning(ex, "Could not resolve store names from tenant DB for token {TokenId}", tokenId);
                    }
                }

                var storeAccess = storeAccessEntries.Select(tsa => new TokenStoreAccessGridDto
                {
                    Id = tsa.Id,
                    TokenId = tsa.TokenId,
                    StoreApp = tokenWithRegistration.StoreApp,
                    StoreId = tsa.StoreId,
                    StoreName = storeNameMap.TryGetValue(tsa.StoreId, out var name) ? name : tsa.StoreId.ToString(),
                    DateCreated = tsa.DateCreated,
                    DateModified = tsa.DateModified
                })
                .OrderBy(x => x.StoreName)
                .ToList();

                return ApiResponseFactory.Success(storeAccess, "Token store access retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<TokenStoreAccessGridDto>>(
                    $"Error fetching token store access: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> BulkUpdateTokenStoreAccessAsync(int tokenId, BulkTokenStoreAccessDto dto, string modifiedBy)
        {
            try
            {
                var tokenEntity = await _dbContext.StoreTokens
                    .Where(x => x.Id == tokenId)
                    .Select(x => new { x.Id, x.Token })
                    .FirstOrDefaultAsync();

                if (tokenEntity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Token not found.");
                }

                if (dto.StoreIds == null || dto.StoreIds.Count == 0)
                {
                    return ApiResponseFactory.BadRequest<bool>("No store IDs provided.");
                }

                // Get existing store access mappings for this token
                var existingMappings = await _dbContext.TokenStoreAccesses
                    .Where(x => x.TokenId == tokenId)
                    .ToListAsync();

                var existingStoreIds = existingMappings.Select(m => m.StoreId).ToList();
                var now = DateTime.UtcNow;

                // Add new mappings for store IDs not already assigned
                var newStoreIds = dto.StoreIds.Except(existingStoreIds).ToList();
                foreach (var storeId in newStoreIds)
                {
                    _dbContext.TokenStoreAccesses.Add(new global::SmartKartReg.Infrastructure.Entities.TokenStoreAccess
                    {
                        TokenId = tokenId,
                        StoreId = storeId,
                        DateCreated = now,
                        CreatedBy = modifiedBy
                    });
                }

                // Remove mappings for store IDs no longer in the list
                var removedStoreIds = existingStoreIds.Except(dto.StoreIds).ToList();
                var mappingsToRemove = existingMappings.Where(m => removedStoreIds.Contains(m.StoreId)).ToList();
                _dbContext.TokenStoreAccesses.RemoveRange(mappingsToRemove);

                await _dbContext.SaveChangesAsync();

                // Invalidate store access cache for this token
                await InvalidateCacheSafe(tokenEntity.Token.ToString(), "TokenStoreAccess");

                return ApiResponseFactory.Success(true, "Token store access updated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error updating token store access: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> RemoveTokenStoreAccessAsync(int id)
        {
            try
            {
                var entity = await _dbContext.TokenStoreAccesses.FindAsync(id);
                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Token store access mapping not found.");
                }

                // Look up the token Guid for cache invalidation
                var tokenGuid = await _dbContext.StoreTokens
                    .Where(x => x.Id == entity.TokenId)
                    .Select(x => x.Token)
                    .FirstOrDefaultAsync();

                _dbContext.TokenStoreAccesses.Remove(entity);
                await _dbContext.SaveChangesAsync();

                // Invalidate store access cache
                if (tokenGuid != default)
                {
                    await InvalidateCacheSafe(tokenGuid.ToString(), "TokenStoreAccess");
                }

                return ApiResponseFactory.Success(true, "Token store access removed successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error removing token store access: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<StoreDropdownDto>>> GetStoresDropdownAsync()
        {
            try
            {
                var stores = await _dbContext.Registrations
                    .Where(r => r.Status != 2)
                    .OrderBy(r => r.StoreName)
                    .Select(r => new StoreDropdownDto
                    {
                        StoreId = r.RegistrationId.ToString(),
                        StoreName = r.StoreName
                    })
                    .ToListAsync();

                return ApiResponseFactory.Success(stores, "Stores dropdown retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<StoreDropdownDto>>(
                    $"Error fetching stores dropdown: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<StoreDropdownDto>>> GetStoresByTokenAsync(int tokenId)
        {
            try
            {
                var tokenWithRegistration = await (
                    from st in _dbContext.StoreTokens
                    join r in _dbContext.Registrations on st.RegistrationId equals r.RegistrationId
                    where st.Id == tokenId
                    select new
                    {
                        r.ServerName,
                        r.DataBaseName,
                        r.UserName,
                        r.Password
                    })
                    .FirstOrDefaultAsync();

                if (tokenWithRegistration == null)
                {
                    return ApiResponseFactory.NotFound<List<StoreDropdownDto>>("Token not found.");
                }

                if (string.IsNullOrWhiteSpace(tokenWithRegistration.ServerName) ||
                    string.IsNullOrWhiteSpace(tokenWithRegistration.DataBaseName))
                {
                    return ApiResponseFactory.BadRequest<List<StoreDropdownDto>>(
                        "Registration does not have valid connection information.");
                }

                await using var tenantDb = _tenantDbContextFactory.CreateForCustomer(
                    tokenWithRegistration.ServerName,
                    tokenWithRegistration.DataBaseName,
                    tokenWithRegistration.UserName,
                    tokenWithRegistration.Password);

                var stores = await tenantDb.Set<Store>()
                    .Where(s => s.Status > -1)
                    .OrderBy(s => s.StoreName)
                    .Select(s => new StoreDropdownDto
                    {
                        StoreId = s.StoreID.ToString(),
                        StoreName = s.StoreName ?? string.Empty
                    })
                    .ToListAsync();

                return ApiResponseFactory.Success(stores, "Tenant stores retrieved successfully.");
            }
            catch (Exception ex)
            {
                Logger.Error(ex, "Error fetching tenant stores for token {TokenId}", tokenId);
                return ApiResponseFactory.InternalError<List<StoreDropdownDto>>(
                    $"Error fetching tenant stores: {ex.Message}");
            }
        }

        /// <summary>
        /// Awaited cache invalidation. Logs errors but does not break the main operation.
        /// The call is awaited so that the HTTP request completes before the response is sent.
        /// </summary>
        private async Task InvalidateCacheSafe(string tokenGuid, params string[] cacheTypes)
        {
            try
            {
                await _connectorApiClient.InvalidateCacheAsync(tokenGuid, cacheTypes);
            }
            catch (Exception ex)
            {
                Logger.Error(ex, "Cache invalidation failed. Token={TokenGuid}, Types=[{CacheTypes}]",
                    tokenGuid, string.Join(", ", cacheTypes));
            }
        }
    }
}
