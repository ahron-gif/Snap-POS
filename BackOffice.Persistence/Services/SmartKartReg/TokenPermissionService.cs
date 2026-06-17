using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.TokenPermission;
using BackOffice.Application.Helpers;
using BackOffice.Application.Integrations.RdtConnectorApi;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using BackOffice.Common;
using BackOffice.Common.Functions;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Serilog;
using SmartKartReg.Infrastructure.DBContext;
using ILogger = Serilog.ILogger;

namespace BackOffice.Persistence.Services.SmartKartReg
{
    public class TokenPermissionService : ITokenPermissionService
    {
        private static readonly ILogger Logger = Log.ForContext<TokenPermissionService>();

        private readonly RegistrationDbContext _dbContext;
        private readonly IRdtConnectorApiClient _connectorApiClient;

        public TokenPermissionService(RegistrationDbContext dbContext, IRdtConnectorApiClient connectorApiClient)
        {
            _dbContext = dbContext;
            _connectorApiClient = connectorApiClient;
        }

        public ApiResponse<PaginationResponseDTO<TokenPermissionGridDto>> GetAllTokenPermissionsGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.TokenPermissions
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
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.TokenPermissions.Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "DateCreated", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<TokenPermissionGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Token permissions retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<TokenPermissionGridDto>>(
                    "Error fetching token permissions.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<TokenPermissionDetailDto>> GetTokenPermissionByIdAsync(int id)
        {
            try
            {
                var tokenPermission = await _dbContext.TokenPermissions
                    .Include(x => x.Permission)
                    .Where(x => x.Id == id)
                    .Select(x => new TokenPermissionDetailDto
                    {
                        Id = x.Id,
                        TokenId = x.TokenId,
                        PermissionId = x.PermissionId,
                        PermissionKey = x.Permission.PermissionKey,
                        PermissionName = x.Permission.PermissionName,
                        Category = x.Permission.Category,
                        IsAllowed = x.IsAllowed,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified,
                        CreatedBy = x.CreatedBy,
                        ModifiedBy = x.ModifiedBy
                    })
                    .FirstOrDefaultAsync();

                if (tokenPermission == null)
                {
                    return ApiResponseFactory.NotFound<TokenPermissionDetailDto>("Token permission not found.");
                }

                return ApiResponseFactory.Success(tokenPermission, "Token permission retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TokenPermissionDetailDto>(
                    $"Error fetching token permission: {ex.Message}");
            }
        }

        public async Task<ApiResponse<int>> CreateTokenPermissionAsync(CreateTokenPermissionDto dto, string createdBy)
        {
            try
            {
                // Validate token exists and get its Guid
                var tokenEntity = await _dbContext.StoreTokens
                    .Where(x => x.Id == dto.TokenId)
                    .Select(x => new { x.Id, x.Token })
                    .FirstOrDefaultAsync();

                if (tokenEntity == null)
                {
                    return ApiResponseFactory.BadRequest<int>("Token not found.");
                }

                // Validate permission exists
                var permissionExists = await _dbContext.Permissions.AnyAsync(x => x.Id == dto.PermissionId);
                if (!permissionExists)
                {
                    return ApiResponseFactory.BadRequest<int>("Permission not found.");
                }

                // Check for duplicate mapping
                var mappingExists = await _dbContext.TokenPermissions
                    .AnyAsync(x => x.TokenId == dto.TokenId && x.PermissionId == dto.PermissionId);

                if (mappingExists)
                {
                    return ApiResponseFactory.BadRequest<int>(
                        "This token-permission mapping already exists.");
                }

                var entity = new global::SmartKartReg.Infrastructure.Entities.TokenPermission
                {
                    TokenId = dto.TokenId,
                    PermissionId = dto.PermissionId,
                    IsAllowed = dto.IsAllowed,
                    DateCreated = DateTime.UtcNow,
                    CreatedBy = createdBy
                };

                _dbContext.TokenPermissions.Add(entity);
                await _dbContext.SaveChangesAsync();

                // Invalidate permissions cache for this token
                await InvalidateCacheSafe(tokenEntity.Token.ToString(), "TokenPermissions");

                return ApiResponseFactory.Success(entity.Id, "Token permission created successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<int>(
                    $"Error creating token permission: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdateTokenPermissionAsync(UpdateTokenPermissionDto dto, string modifiedBy)
        {
            try
            {
                var entity = await _dbContext.TokenPermissions.FindAsync(dto.Id);
                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Token permission not found.");
                }

                // Validate token exists and get its Guid
                var tokenEntity = await _dbContext.StoreTokens
                    .Where(x => x.Id == dto.TokenId)
                    .Select(x => new { x.Id, x.Token })
                    .FirstOrDefaultAsync();

                if (tokenEntity == null)
                {
                    return ApiResponseFactory.BadRequest<bool>("Token not found.");
                }

                // Validate permission exists
                var permissionExists = await _dbContext.Permissions.AnyAsync(x => x.Id == dto.PermissionId);
                if (!permissionExists)
                {
                    return ApiResponseFactory.BadRequest<bool>("Permission not found.");
                }

                // Check for duplicate mapping (excluding current)
                var mappingExists = await _dbContext.TokenPermissions
                    .AnyAsync(x => x.TokenId == dto.TokenId && x.PermissionId == dto.PermissionId && x.Id != dto.Id);

                if (mappingExists)
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        "This token-permission mapping already exists.");
                }

                // If token changed, we need to invalidate both old and new token caches
                var oldTokenGuid = entity.TokenId != dto.TokenId
                    ? await _dbContext.StoreTokens.Where(x => x.Id == entity.TokenId).Select(x => x.Token).FirstOrDefaultAsync()
                    : default;

                entity.TokenId = dto.TokenId;
                entity.PermissionId = dto.PermissionId;
                entity.IsAllowed = dto.IsAllowed;
                entity.DateModified = DateTime.UtcNow;
                entity.ModifiedBy = modifiedBy;

                await _dbContext.SaveChangesAsync();

                // Invalidate permissions cache for the current token
                await InvalidateCacheSafe(tokenEntity.Token.ToString(), "TokenPermissions");

                // If token was reassigned, also invalidate the old token's cache
                if (oldTokenGuid != default)
                {
                    await InvalidateCacheSafe(oldTokenGuid.ToString(), "TokenPermissions");
                }

                return ApiResponseFactory.Success(true, "Token permission updated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error updating token permission: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteTokenPermissionAsync(int id)
        {
            try
            {
                var entity = await _dbContext.TokenPermissions.FindAsync(id);
                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Token permission not found.");
                }

                // Look up the token Guid for cache invalidation
                var tokenGuid = await _dbContext.StoreTokens
                    .Where(x => x.Id == entity.TokenId)
                    .Select(x => x.Token)
                    .FirstOrDefaultAsync();

                _dbContext.TokenPermissions.Remove(entity);
                await _dbContext.SaveChangesAsync();

                // Invalidate permissions cache
                if (tokenGuid != default)
                {
                    await InvalidateCacheSafe(tokenGuid.ToString(), "TokenPermissions");
                }

                return ApiResponseFactory.Success(true, "Token permission deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error deleting token permission: {ex.Message}");
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
