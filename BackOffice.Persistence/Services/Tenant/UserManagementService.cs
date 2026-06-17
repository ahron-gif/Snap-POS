// =============================================================================
// LEGACY FILE - kept for reference. Disabled via #if false; active replacement
// is WebUserManagementService in the same folder.
// =============================================================================
#if false
using AutoMapper;
using BackOffice.Application.DTOs.Tenant.User;
using BackOffice.Application.Interfaces.Repositories.Main;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using BackOffice.Persistence.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Tenant
{
    public class UserManagementService : IUserManagementService
    {
        private readonly IUnitOfWorkTenant _unitOfWorkTenant;
        private readonly IUnitOfWorkMain _unitOfWorkMain;
        private readonly IMapper _mapper;
        private readonly ILogger<UserManagementService> _logger;
        private readonly TenantDBContext _dbContext;
        private readonly MainDBContext _mainDb;
        private readonly IUsageTrackingService _usageTrackingService;

        public UserManagementService(
            IUnitOfWorkTenant unitOfWorkTenant,
            IUnitOfWorkMain unitOfWorkMain,
            IMapper mapper,
            ILogger<UserManagementService> logger,
            TenantDBContext dbContext,
            MainDBContext mainDb,
            IUsageTrackingService usageTrackingService)
        {
            _unitOfWorkTenant = unitOfWorkTenant;
            _unitOfWorkMain = unitOfWorkMain;
            _mapper = mapper;
            _logger = logger;
            _dbContext = dbContext;
            _mainDb = mainDb;
            _usageTrackingService = usageTrackingService;
        }

        public async Task<ApiResponse<UserDetailDto>> CreateUserAsync(CreateUserDto dto, int customerId)
        {
            try
            {
                if (customerId > 0)
                {
                    var limitCheck = await _usageTrackingService.CheckWebAppUserLimitAsync(customerId);
                    if (limitCheck.IsSuccess
                        && limitCheck.Response != null
                        && !limitCheck.Response.Allowed)
                    {
                        return ApiResponseFactory.BadRequest<UserDetailDto>(
                            limitCheck.Response.Reason
                            ?? $"App user limit reached ({limitCheck.Response.UsersUsed}/{limitCheck.Response.SlotsTotal}).");
                    }
                }

                var sharedUserId = Guid.NewGuid();

                await using var transaction = await _unitOfWorkMain.BeginTransactionAsync();
                try
                {
                    var appUser = new AppUser
                    {
                        UserName = dto.UserName,
                        Password = dto.Password,
                        PasswordHash = !string.IsNullOrEmpty(dto.Password) ? PasswordHelper.HashPassword(dto.Password) : "",
                        Email = dto.Email,
                        Phone = dto.HomePhoneNumber,
                        LocalUserId = sharedUserId,
                        CustomerId = customerId,
                        DateCreated = DateTime.UtcNow,
                        InviteStatus = 0,
                        LoginType = "Email",
                        UserFName = dto.UserFName,
                        UserLName = dto.UserLName,
                        Address = dto.Address,
                        WorkPhoneNumber = dto.WorkPhoneNumber,
                        Fax = dto.Fax,
                        ZipCode = dto.ZipCode,
                        IsSuperAdmin = dto.IsSuperAdmin,
                        Status = 1
                    };

                    await _unitOfWorkMain.AppUsers.AddAsync(appUser);
                    await _unitOfWorkMain.SaveChangesAsync();

                    if (customerId > 0)
                    {
                        var assignment = new UserTenantAssignment
                        {
                            UserId = appUser.UserId,
                            CustomerId = customerId,
                            AssignedBy = appUser.UserId,
                            AssignedAt = DateTime.UtcNow
                        };
                        _mainDb.UserTenantAssignments.Add(assignment);
                        await _mainDb.SaveChangesAsync();
                    }

                    var tenantUser = new User
                    {
                        UserId = sharedUserId,
                        UserName = dto.UserName,
                        Password = dto.Password,
                        PasswordHash = !string.IsNullOrEmpty(dto.Password) ? PasswordHelper.HashPassword(dto.Password) : "",
                        UserFName = dto.UserFName,
                        UserLName = dto.UserLName,
                        Email = dto.Email,
                        Address = dto.Address,
                        HomePhoneNumber = dto.HomePhoneNumber,
                        WorkPhoneNumber = dto.WorkPhoneNumber,
                        Fax = dto.Fax,
                        ZipCode = dto.ZipCode,
                        IsSuperAdmin = dto.IsSuperAdmin,
                        Status = 1,
                        DateCreated = DateTime.UtcNow
                    };

                    await _unitOfWorkTenant.Users.AddAsync(tenantUser);
                    await _unitOfWorkTenant.SaveChangesAsync();

                    await SaveUserStoreAssignmentsAsync(sharedUserId, dto.StoreIds, dto.DefaultStoreId, dto.GroupId);

                    await _unitOfWorkMain.CommitTransactionAsync();

                    var result = MapToDetailDto(tenantUser, appUser);
                    result.AssignedStores = await GetUserStoreAssignmentsAsync(sharedUserId);
                    result.GroupId = dto.GroupId;
                    return ApiResponseFactory.Success(result, "User created successfully");
                }
                catch
                {
                    await _unitOfWorkMain.RollbackTransactionAsync();
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user: {UserName}", dto.UserName);
                return ApiResponseFactory.InternalError<UserDetailDto>("Failed to create user");
            }
        }

        public async Task<ApiResponse<UserDetailDto>> UpdateUserAsync(UpdateUserDto dto)
        {
            try
            {
                var appUser = await _unitOfWorkMain.AppUsers
                    .FirstOrDefaultAsync(a => a.LocalUserId == dto.TenantUserId);

                if (appUser == null)
                    return ApiResponseFactory.NotFound<UserDetailDto>("User not found in main database");

                var tenantUser = await _unitOfWorkTenant.Users
                    .FirstOrDefaultAsync(u => u.UserId == dto.TenantUserId);

                if (tenantUser == null)
                {
                    tenantUser = new User
                    {
                        UserId = appUser.LocalUserId,
                        UserName = appUser.UserName,
                        Password = appUser.Password,
                        PasswordHash = appUser.PasswordHash,
                        UserFName = appUser.UserFName,
                        UserLName = appUser.UserLName,
                        Email = appUser.Email,
                        Address = appUser.Address,
                        HomePhoneNumber = appUser.Phone,
                        WorkPhoneNumber = appUser.WorkPhoneNumber,
                        Fax = appUser.Fax,
                        ZipCode = appUser.ZipCode,
                        IsSuperAdmin = appUser.IsSuperAdmin,
                        Status = appUser.Status ?? 1,
                        DateCreated = DateTime.UtcNow,
                        ScanID = appUser.ScanID,
                        IsLogIn = appUser.IsLogIn
                    };

                    await _unitOfWorkTenant.Users.AddAsync(tenantUser);
                    await _unitOfWorkTenant.SaveChangesAsync();

                    _logger.LogInformation("Synced user {UserId} from MainDB to TenantDB during update", dto.TenantUserId);
                }

                tenantUser.UserName = dto.UserName;
                tenantUser.UserFName = dto.UserFName;
                tenantUser.UserLName = dto.UserLName;
                tenantUser.Email = dto.Email;
                tenantUser.Address = dto.Address;
                tenantUser.HomePhoneNumber = dto.HomePhoneNumber;
                tenantUser.WorkPhoneNumber = dto.WorkPhoneNumber;
                tenantUser.Fax = dto.Fax;
                tenantUser.ZipCode = dto.ZipCode;
                tenantUser.IsSuperAdmin = dto.IsSuperAdmin;
                tenantUser.DateModified = DateTime.UtcNow;

                if (!string.IsNullOrEmpty(dto.Password))
                {
                    tenantUser.Password = dto.Password;
                    tenantUser.PasswordHash = PasswordHelper.HashPassword(dto.Password);
                }

                await _unitOfWorkTenant.SaveChangesAsync();

                appUser.UserName = dto.UserName;
                appUser.Email = dto.Email;
                appUser.Phone = dto.HomePhoneNumber;
                appUser.UserFName = dto.UserFName;
                appUser.UserLName = dto.UserLName;
                appUser.Address = dto.Address;
                appUser.WorkPhoneNumber = dto.WorkPhoneNumber;
                appUser.Fax = dto.Fax;
                appUser.ZipCode = dto.ZipCode;
                appUser.IsSuperAdmin = dto.IsSuperAdmin;
                appUser.DateModified = DateTime.UtcNow;

                if (!string.IsNullOrEmpty(dto.Password))
                {
                    appUser.Password = dto.Password;
                    appUser.PasswordHash = PasswordHelper.HashPassword(dto.Password);
                }

                await _unitOfWorkMain.SaveChangesAsync();

                await _dbContext.UsersStores
                    .Where(us => us.UserID == dto.TenantUserId)
                    .ExecuteDeleteAsync();

                await SaveUserStoreAssignmentsAsync(dto.TenantUserId, dto.StoreIds, dto.DefaultStoreId, dto.GroupId);

                var result = MapToDetailDto(tenantUser, appUser);
                result.AssignedStores = await GetUserStoreAssignmentsAsync(dto.TenantUserId);
                result.GroupId = dto.GroupId;
                return ApiResponseFactory.Success(result, "User updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user: {TenantUserId}", dto.TenantUserId);
                return ApiResponseFactory.InternalError<UserDetailDto>("Failed to update user");
            }
        }

        public async Task<ApiResponse<bool>> DeleteUserAsync(Guid tenantUserId)
        {
            try
            {
                var tenantUser = await _unitOfWorkTenant.Users
                    .FirstOrDefaultAsync(u => u.UserId == tenantUserId);

                if (tenantUser == null)
                    return ApiResponseFactory.NotFound<bool>("User not found in tenant database");

                var appUser = await _unitOfWorkMain.AppUsers
                    .FirstOrDefaultAsync(a => a.LocalUserId == tenantUserId);

                await _dbContext.UsersStores
                    .Where(us => us.UserID == tenantUserId)
                    .ExecuteDeleteAsync();

                _unitOfWorkTenant.Users.Remove(tenantUser);
                await _unitOfWorkTenant.SaveChangesAsync();

                if (appUser != null)
                {
                    await _mainDb.UserTenantAssignments
                        .Where(a => a.UserId == appUser.UserId)
                        .ExecuteDeleteAsync();

                    _unitOfWorkMain.AppUsers.Remove(appUser);
                    await _unitOfWorkMain.SaveChangesAsync();
                }

                return ApiResponseFactory.Success(true, "User deleted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user: {TenantUserId}", tenantUserId);
                return ApiResponseFactory.InternalError<bool>("Failed to delete user");
            }
        }

        public async Task<ApiResponse<UserDetailDto>> GetUserByIdAsync(Guid tenantUserId)
        {
            try
            {
                var tenantUser = await _unitOfWorkTenant.Users
                    .FirstOrDefaultAsync(u => u.UserId == tenantUserId);

                var appUser = await _unitOfWorkMain.AppUsers
                    .FirstOrDefaultAsync(a => a.LocalUserId == tenantUserId);

                if (tenantUser == null)
                {
                    if (appUser == null)
                        return ApiResponseFactory.NotFound<UserDetailDto>("User not found");

                    tenantUser = new User
                    {
                        UserId = appUser.LocalUserId,
                        UserName = appUser.UserName,
                        Password = appUser.Password,
                        PasswordHash = appUser.PasswordHash,
                        UserFName = appUser.UserFName,
                        UserLName = appUser.UserLName,
                        Email = appUser.Email,
                        Address = appUser.Address,
                        HomePhoneNumber = appUser.Phone,
                        WorkPhoneNumber = appUser.WorkPhoneNumber,
                        Fax = appUser.Fax,
                        ZipCode = appUser.ZipCode,
                        IsSuperAdmin = appUser.IsSuperAdmin,
                        Status = appUser.Status ?? 1,
                        DateCreated = DateTime.UtcNow,
                        ScanID = appUser.ScanID,
                        IsLogIn = appUser.IsLogIn
                    };

                    await _unitOfWorkTenant.Users.AddAsync(tenantUser);
                    await _unitOfWorkTenant.SaveChangesAsync();

                    _logger.LogInformation("Synced user {UserId} from MainDB to TenantDB", tenantUserId);
                }

                var result = MapToDetailDto(tenantUser, appUser);
                result.AssignedStores = await GetUserStoreAssignmentsAsync(tenantUserId);

                var firstStoreAssignment = await _dbContext.UsersStores
                    .FirstOrDefaultAsync(us => us.UserID == tenantUserId);
                result.GroupId = firstStoreAssignment?.GroupID;

                return ApiResponseFactory.Success(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user: {TenantUserId}", tenantUserId);
                return ApiResponseFactory.InternalError<UserDetailDto>("Failed to get user");
            }
        }

        private async System.Threading.Tasks.Task SaveUserStoreAssignmentsAsync(Guid userId, List<Guid>? storeIds, Guid? defaultStoreId, Guid? groupId)
        {
            if (storeIds == null || storeIds.Count == 0)
                return;

            var uniqueStoreIds = storeIds.Distinct().ToList();

            var existingStoreIds = await _dbContext.UsersStores
                .Where(us => us.UserID == userId)
                .Select(us => us.StoreID)
                .ToListAsync();

            foreach (var storeId in uniqueStoreIds)
            {
                if (existingStoreIds.Contains(storeId))
                    continue;

                var userStore = new UsersStore
                {
                    UserStoreID = Guid.NewGuid(),
                    UserID = userId,
                    StoreID = storeId,
                    IsDefault = storeId == defaultStoreId,
                    Manager = false,
                    GroupID = groupId,
                    OnLine = false,
                    Status = 1,
                    DateCreated = DateTime.UtcNow
                };
                _dbContext.UsersStores.Add(userStore);
            }
            await _dbContext.SaveChangesAsync();
        }

        private async Task<List<UserStoreAssignmentDto>> GetUserStoreAssignmentsAsync(Guid userId)
        {
            return await _dbContext.UsersStores
                .Where(us => us.UserID == userId)
                .Join(
                    _dbContext.Stores,
                    us => us.StoreID,
                    s => s.StoreID,
                    (us, s) => new UserStoreAssignmentDto
                    {
                        StoreId = s.StoreID,
                        StoreName = s.StoreName ?? string.Empty,
                        IsDefault = us.IsDefault ?? false,
                        IsManager = us.Manager ?? false
                    })
                .ToListAsync();
        }

        private static UserDetailDto MapToDetailDto(User tenantUser, AppUser? appUser)
        {
            return new UserDetailDto
            {
                TenantUserId = tenantUser.UserId,
                MainUserId = appUser?.UserId ?? 0,
                UserName = tenantUser.UserName ?? appUser?.UserName ?? string.Empty,
                UserFName = tenantUser.UserFName ?? appUser?.UserFName,
                UserLName = tenantUser.UserLName ?? appUser?.UserLName,
                Email = tenantUser.Email ?? appUser?.Email,
                Address = tenantUser.Address ?? appUser?.Address,
                HomePhoneNumber = tenantUser.HomePhoneNumber ?? appUser?.Phone,
                WorkPhoneNumber = tenantUser.WorkPhoneNumber ?? appUser?.WorkPhoneNumber,
                Fax = tenantUser.Fax ?? appUser?.Fax,
                ZipCode = tenantUser.ZipCode ?? appUser?.ZipCode,
                IsSuperAdmin = tenantUser.IsSuperAdmin ?? appUser?.IsSuperAdmin,
                Status = tenantUser.Status ?? appUser?.Status,
                DateCreated = tenantUser.DateCreated,
                DateModified = tenantUser.DateModified,
                CustomerId = appUser?.CustomerId,
                Phone = appUser?.Phone
            };
        }
    }
}
#endif
