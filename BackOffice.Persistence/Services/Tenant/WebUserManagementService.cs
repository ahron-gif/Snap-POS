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
    /// <summary>
    /// User management service for the web app.
    ///
    /// Dual-write strategy:
    ///   • Primary writes go to the Web* tables (WebAppUser, WebUser, WebUsersStore).
    ///   • Mirror writes also go to the legacy tables (AppUser, User, UsersStore) so the
    ///     desktop POS continues to see the same users.
    ///   • WebUsersStore allows multiple store assignments per user.
    ///   • UsersStore (legacy) is written with ONE row per user — the default store.
    ///
    /// LocalUserId (Guid) is the cross-DB linking key: identical value in both AppUser
    /// and WebAppUser, and also used as UserId in User and WebUser.
    ///
    /// PERFORMANCE NOTE:
    /// _unitOfWorkMain._dbContext and _mainDb are the SAME scoped MainDBContext
    /// instance (likewise for tenant). All Add()/AddAsync() calls on either
    /// surface queue against the same change tracker, so a single SaveChangesAsync
    /// on either flushes everything. CreateUserAsync needs two main-DB saves only
    /// because UserTenantAssignment.UserId depends on the WebAppUser IDENTITY
    /// value, which is not populated until after the first save.
    /// </summary>
    public class WebUserManagementService : IWebUserManagementService
    {
        private readonly IUnitOfWorkTenant _unitOfWorkTenant;
        private readonly IUnitOfWorkMain _unitOfWorkMain;
        private readonly IMapper _mapper;
        private readonly ILogger<WebUserManagementService> _logger;
        private readonly TenantDBContext _dbContext;
        private readonly MainDBContext _mainDb;
        private readonly IUsageTrackingService _usageTrackingService;

        public WebUserManagementService(
            IUnitOfWorkTenant unitOfWorkTenant,
            IUnitOfWorkMain unitOfWorkMain,
            IMapper mapper,
            ILogger<WebUserManagementService> logger,
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

        public async Task<ApiResponse<UserDetailDto>> CreateUserAsync(CreateUserDto dto, int customerId, bool callerIsSuperAdmin)
        {
            try
            {
                // Only super-admins may grant the super-admin flag. Silently demoting a
                // self-elevation attempt would mask the misuse, so reject it outright.
                if (dto.IsSuperAdmin && !callerIsSuperAdmin)
                {
                    return ApiResponseFactory.Forbidden<UserDetailDto>(
                        "Only a Super Admin can create another Super Admin user.");
                }

                // Email uniqueness — checked against the authoritative WebAppUsers table.
                var emailError = await ValidateEmailUniqueAsync(dto.Email, excludeUserId: null);
                if (emailError != null) return emailError;

                // Username uniqueness — the tenant DB has a UNIQUE filtered index on
                // WebUsers.UserName (active rows), so a clash would otherwise throw
                // an opaque DbUpdateException after the MainDB save has already run.
                var userNameError = await ValidateUserNameUniqueAsync(dto.UserName, excludeTenantUserId: null);
                if (userNameError != null) return userNameError;

                if (customerId > 0)
                {
                    var limitCheck = await _usageTrackingService.CheckWebAppUserLimitAsync(customerId);
                    if (limitCheck.IsSuccess
                        && limitCheck.Response != null
                        && !limitCheck.Response.Allowed)

                    {
                        return ApiResponseFactory.BadRequest<UserDetailDto>(
                            limitCheck.Response.Reason

                            ?? $"Web App user limit reached ({limitCheck.Response.UsersUsed}/{limitCheck.Response.SlotsTotal}).");
                    }
                }

                // ── Super-admin gate ────────────────────────────────────────
                // The explicit `IsSuperAdmin` flag on the user record is the
                // single source of truth. When true, the user has implicit
                // platform access and the tenant + store assignment rules
                // below are skipped. Otherwise the user MUST have at least
                // one store, a default store, and (for super-admin operator
                // flow with customerId == 0) at least one tenant assignment.
                if (!dto.IsSuperAdmin)
                {
                    if (dto.StoreIds is null || dto.StoreIds.Count == 0)
                        return ApiResponseFactory.BadRequest<UserDetailDto>(
                            "At least one store must be assigned for non-super-admin users.");
                    if (dto.DefaultStoreId is null)
                        return ApiResponseFactory.BadRequest<UserDetailDto>(
                            "A default store must be selected for non-super-admin users.");
                    if (customerId == 0 && (dto.CustomerIds is null || dto.CustomerIds.Count == 0))
                        return ApiResponseFactory.BadRequest<UserDetailDto>(
                            "At least one tenant must be assigned for non-super-admin users.");
                }

                var sharedUserId = Guid.NewGuid();
                var passwordHash = !string.IsNullOrEmpty(dto.Password) ? PasswordHelper.HashPassword(dto.Password) : "";
                var now = DateTime.UtcNow;

                // Super admins exist outside the tenant model: CustomerId must be NULL and
                // they get NO UserTenantAssignment row. Otherwise the permission resolver
                // tries to load tenant-scoped roles for them and finds none → "No Access".
                var effectiveCustomerId = dto.IsSuperAdmin ? (int?)null : customerId;

                await using var transaction = await _unitOfWorkMain.BeginTransactionAsync();
                try
                {
                    // -----------------------------------------------------------------
                    // MAIN DB save #1 — WebAppUser only.
                    // Required separately because WebAppUser.UserId is an IDENTITY and
                    // we need that value for UserTenantAssignment.UserId below.
                    // -----------------------------------------------------------------
                    var webAppUser = BuildWebAppUser(dto, sharedUserId, passwordHash, effectiveCustomerId, now);
                    _mainDb.WebAppUsers.Add(webAppUser);
                    await _mainDb.SaveChangesAsync();   // round-trip 1

                    // -----------------------------------------------------------------
                    // MAIN DB save #2 — legacy AppUser mirror + UserTenantAssignment.
                    // Queued together, flushed in one round-trip.
                    // -----------------------------------------------------------------
                    var legacyAppUser = BuildLegacyAppUser(dto, sharedUserId, passwordHash, effectiveCustomerId, now);
                    _mainDb.AppUsers.Add(legacyAppUser);

                    if (!dto.IsSuperAdmin && customerId > 0)
                    {
                        _mainDb.UserTenantAssignments.Add(new UserTenantAssignment
                        {
                            UserId = webAppUser.UserId,
                            CustomerId = customerId,
                            AssignedBy = webAppUser.UserId,
                            AssignedAt = now
                        });
                    }
                    await _mainDb.SaveChangesAsync();   // round-trip 2

                    // -----------------------------------------------------------------
                    // TENANT DB save — everything in one round-trip:
                    //   WebUser + legacy User + N × WebUsersStore + 1 × legacy UsersStore.
                    // No existence checks because the user is brand new (sharedUserId
                    // was just generated, so nothing referencing it can exist yet).
                    // -----------------------------------------------------------------
                    var webTenantUser = BuildWebUser(dto, sharedUserId, passwordHash, now);
                    _dbContext.WebUsers.Add(webTenantUser);

                    var legacyTenantUser = BuildLegacyTenantUser(dto, sharedUserId, passwordHash, now);
                    _dbContext.Users.Add(legacyTenantUser);

                    var uniqueStoreIds = dto.StoreIds?.Distinct().ToList() ?? new List<Guid>();
                    if (uniqueStoreIds.Count > 0)
                    {
                        foreach (var storeId in uniqueStoreIds)
                        {
                            _dbContext.WebUsersStores.Add(new WebUsersStore
                            {
                                UserStoreID = Guid.NewGuid(),
                                UserID = sharedUserId,
                                StoreID = storeId,
                                IsDefault = storeId == dto.DefaultStoreId,
                                Manager = false,
                                GroupID = dto.GroupId,
                                OnLine = false,
                                Status = 1,
                                DateCreated = now
                            });
                        }

                        // Single legacy UsersStore row — pick default store (or first).
                        var pickStoreId = (dto.DefaultStoreId.HasValue && uniqueStoreIds.Contains(dto.DefaultStoreId.Value))
                            ? dto.DefaultStoreId.Value
                            : uniqueStoreIds[0];

                        _dbContext.UsersStores.Add(new UsersStore
                        {
                            UserStoreID = Guid.NewGuid(),
                            UserID = sharedUserId,
                            StoreID = pickStoreId,
                            IsDefault = true,
                            Manager = false,
                            GroupID = dto.GroupId,
                            OnLine = false,
                            Status = 1,
                            DateCreated = now
                        });
                    }
                    await _dbContext.SaveChangesAsync();   // round-trip 3

                    await _unitOfWorkMain.CommitTransactionAsync();   // round-trip 4

                    // -----------------------------------------------------------------
                    // Build response. One SELECT for store names — only if needed.
                    // -----------------------------------------------------------------
                    var assignedStores = await BuildStoreAssignmentDtosAsync(uniqueStoreIds, dto.DefaultStoreId);

                    var result = MapToDetailDto(webTenantUser, webAppUser);
                    result.AssignedStores = assignedStores;
                    result.GroupId = dto.GroupId;
                    return ApiResponseFactory.Success(result, "User created successfully");
                }
                catch
                {
                    await _unitOfWorkMain.RollbackTransactionAsync();
                    throw;
                }
            }
            catch (DbUpdateException dbex)
            {
                _logger.LogError(dbex, "DB error creating user: {UserName}", dto.UserName);
                return ApiResponseFactory.InternalError<UserDetailDto>(
                    "Failed to create user: " + (dbex.InnerException?.Message ?? dbex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user: {UserName}", dto.UserName);
                return ApiResponseFactory.InternalError<UserDetailDto>(
                    "Failed to create user: " + ex.Message);
            }
        }

        public async Task<ApiResponse<UserDetailDto>> UpdateUserAsync(UpdateUserDto dto, bool callerIsSuperAdmin)
        {
            try
            {
                // ── Super-admin gate (same as CreateUserAsync) ─────────────
                if (!dto.IsSuperAdmin)
                {
                    if (dto.StoreIds is null || dto.StoreIds.Count == 0)
                        return ApiResponseFactory.BadRequest<UserDetailDto>(
                            "At least one store must be assigned for non-super-admin users.");
                    if (dto.DefaultStoreId is null)
                        return ApiResponseFactory.BadRequest<UserDetailDto>(
                            "A default store must be selected for non-super-admin users.");
                }

                // -----------------------------------------------------------------
                // Look up all four user records (one per table) — sequential because
                // EF DbContexts are not safe for concurrent use.
                // -----------------------------------------------------------------
                var webAppUser = await _mainDb.WebAppUsers
                    .FirstOrDefaultAsync(a => a.LocalUserId == dto.TenantUserId);

                if (webAppUser == null)
                    return ApiResponseFactory.NotFound<UserDetailDto>("User not found in main database");

                // Authorize super-admin flag transitions. Promotion AND demotion both
                // require an existing super-admin caller — otherwise a tenant admin
                // could silently strip privileges from a colleague.
                var wasSuperAdmin = webAppUser.IsSuperAdmin == true;
                if (dto.IsSuperAdmin != wasSuperAdmin && !callerIsSuperAdmin)
                {
                    return ApiResponseFactory.Forbidden<UserDetailDto>(
                        "Only a Super Admin can change the Super Admin status of a user.");
                }

                // Email uniqueness — excluding the row being updated.
                var emailError = await ValidateEmailUniqueAsync(dto.Email, excludeUserId: webAppUser.UserId);
                if (emailError != null) return emailError;

                // Username uniqueness — excluding the current tenant-DB row.
                var userNameError = await ValidateUserNameUniqueAsync(dto.UserName, excludeTenantUserId: dto.TenantUserId);
                if (userNameError != null) return userNameError;

                var legacyAppUser = await _mainDb.AppUsers
                    .FirstOrDefaultAsync(a => a.LocalUserId == dto.TenantUserId);

                var webTenantUser = await _dbContext.WebUsers
                    .FirstOrDefaultAsync(u => u.UserId == dto.TenantUserId);

                var legacyTenantUser = await _dbContext.Users
                    .FirstOrDefaultAsync(u => u.UserId == dto.TenantUserId);

                var passwordHash = !string.IsNullOrEmpty(dto.Password) ? PasswordHelper.HashPassword(dto.Password) : null;
                var now = DateTime.UtcNow;

                // -----------------------------------------------------------------
                // Lazy-create any missing legacy / web tenant mirror (pre-dual-write
                // users may not have a legacy or tenant row).
                // -----------------------------------------------------------------
                if (webTenantUser == null)
                {
                    webTenantUser = CloneAppUserToWebUser(webAppUser, dto.TenantUserId, now);
                    _dbContext.WebUsers.Add(webTenantUser);
                    _logger.LogInformation("Synced user {UserId} from MainDB to TenantDB during update", dto.TenantUserId);
                }

                if (legacyTenantUser == null)
                {
                    legacyTenantUser = new User
                    {
                        UserId = dto.TenantUserId,
                        Status = 1,
                        DateCreated = now
                    };
                    _dbContext.Users.Add(legacyTenantUser);
                }

                if (legacyAppUser == null)
                {
                    legacyAppUser = new AppUser
                    {
                        UserName = dto.UserName,
                        Password = dto.Password ?? "",
                        PasswordHash = passwordHash ?? "",
                        LocalUserId = dto.TenantUserId,
                        CustomerId = webAppUser.CustomerId,
                        DateCreated = now,
                        InviteStatus = 0,
                        Status = 1,
                        HasWebAccess = true,
                        LoginType = "Email"
                    };
                    _mainDb.AppUsers.Add(legacyAppUser);
                }

                // -----------------------------------------------------------------
                // Apply DTO changes (tracked entities in-memory; no DB round-trip yet).
                // -----------------------------------------------------------------
                ApplyDtoToTenantUser(webTenantUser, dto, passwordHash, now);
                ApplyDtoToTenantUser(legacyTenantUser, dto, passwordHash, now);
                ApplyDtoToAppUser(webAppUser, dto, passwordHash, now);
                ApplyDtoToAppUser(legacyAppUser, dto, passwordHash, now);

                // -----------------------------------------------------------------
                // Super-admin promotion: detach from any tenant. Super admins exist
                // outside the tenant model — CustomerId must be NULL and all
                // UserTenantAssignment rows for this user are wiped, otherwise the
                // permission resolver tries (and fails) to load tenant-scoped roles
                // for them.
                //
                // Demotion (true → false) is NOT handled here: a demoted user needs
                // a target CustomerId, which this endpoint doesn't receive. We leave
                // CustomerId as-is on demote; a follow-up admin action must assign
                // the user to a tenant before they can log in usefully.
                // -----------------------------------------------------------------
                if (dto.IsSuperAdmin && !wasSuperAdmin)
                {
                    webAppUser.CustomerId = null;
                    legacyAppUser.CustomerId = null;

                    await _mainDb.UserTenantAssignments
                        .Where(a => a.UserId == webAppUser.UserId)
                        .ExecuteDeleteAsync();
                }

                // -----------------------------------------------------------------
                // Replace store assignments on tenant DB.
                // Order: delete-old → queue inserts → single SaveChanges that flushes
                // BOTH the user-field updates and the new store inserts.
                // -----------------------------------------------------------------
                await _dbContext.WebUsersStores
                    .Where(us => us.UserID == dto.TenantUserId)
                    .ExecuteDeleteAsync();

                await _dbContext.UsersStores
                    .Where(us => us.UserID == dto.TenantUserId)
                    .ExecuteDeleteAsync();

                var uniqueStoreIds = dto.StoreIds?.Distinct().ToList() ?? new List<Guid>();
                if (uniqueStoreIds.Count > 0)
                {
                    foreach (var storeId in uniqueStoreIds)
                    {
                        _dbContext.WebUsersStores.Add(new WebUsersStore
                        {
                            UserStoreID = Guid.NewGuid(),
                            UserID = dto.TenantUserId,
                            StoreID = storeId,
                            IsDefault = storeId == dto.DefaultStoreId,
                            Manager = false,
                            GroupID = dto.GroupId,
                            OnLine = false,
                            Status = 1,
                            DateCreated = now
                        });
                    }

                    var pickStoreId = (dto.DefaultStoreId.HasValue && uniqueStoreIds.Contains(dto.DefaultStoreId.Value))
                        ? dto.DefaultStoreId.Value
                        : uniqueStoreIds[0];

                    _dbContext.UsersStores.Add(new UsersStore
                    {
                        UserStoreID = Guid.NewGuid(),
                        UserID = dto.TenantUserId,
                        StoreID = pickStoreId,
                        IsDefault = true,
                        Manager = false,
                        GroupID = dto.GroupId,
                        OnLine = false,
                        Status = 1,
                        DateCreated = now
                    });
                }

                // One SaveChanges per DbContext flushes all queued mutations.
                await _dbContext.SaveChangesAsync();   // tenant: user updates + store inserts
                await _mainDb.SaveChangesAsync();      // main: user updates

                // -----------------------------------------------------------------
                // Build response — one SELECT for store names.
                // -----------------------------------------------------------------
                var assignedStores = await BuildStoreAssignmentDtosAsync(uniqueStoreIds, dto.DefaultStoreId);

                var result = MapToDetailDto(webTenantUser, webAppUser);
                result.AssignedStores = assignedStores;
                result.GroupId = dto.GroupId;
                return ApiResponseFactory.Success(result, "User updated successfully");
            }
            catch (DbUpdateException dbex)
            {
                _logger.LogError(dbex, "DB error updating user: {TenantUserId}", dto.TenantUserId);
                return ApiResponseFactory.InternalError<UserDetailDto>(
                    "Failed to update user: " + (dbex.InnerException?.Message ?? dbex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user: {TenantUserId}", dto.TenantUserId);
                return ApiResponseFactory.InternalError<UserDetailDto>(
                    "Failed to update user: " + ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> DeleteUserAsync(Guid tenantUserId)
        {
            try
            {
                // WebAppUser.UserId (int) is the key used by every row that
                // references the user by their main-DB integer id — tenant
                // assignments, RBAC role grants/overrides, environment access.
                // Look it up once so we can clean those up before deleting the
                // parent user rows.
                var webAppUser = await _mainDb.WebAppUsers
                    .Select(a => new { a.UserId, a.LocalUserId })
                    .FirstOrDefaultAsync(a => a.LocalUserId == tenantUserId);

                var existsInTenant = await _dbContext.WebUsers
                    .AnyAsync(u => u.UserId == tenantUserId);

                if (!existsInTenant && webAppUser == null)
                    return ApiResponseFactory.NotFound<bool>("User not found");

                // The user's integer id (shared by AppUser and WebAppUser) keys
                // every auth/session/MFA/token/role/assignment row in the main DB
                // and the RBAC grants in the tenant DB. Prefer the WebAppUser id;
                // fall back to the legacy AppUser id when there's no WebAppUser.
                int? userIntId = webAppUser?.UserId
                    ?? await _mainDb.AppUsers
                        .Where(a => a.LocalUserId == tenantUserId)
                        .Select(a => (int?)a.UserId)
                        .FirstOrDefaultAsync();

                // ── Best-effort cleanup of the user's owned auxiliary rows ───
                // Each delete runs INDEPENDENTLY: a table that doesn't exist in
                // this database, or a delete that finds nothing, must never abort
                // the whole operation. A genuine blocker on the actual user rows
                // is reported by the catch below. No wrapping transaction — these
                // contexts use a retrying execution strategy and each
                // ExecuteDeleteAsync is already its own retriable unit.
                async System.Threading.Tasks.Task TryCleanup(
                    Func<System.Threading.Tasks.Task> delete, string what)
                {
                    try
                    {
                        await delete();
                    }
                    catch (Exception cleanupEx)
                    {
                        // Swallow & log: an optional/missing table or an empty set
                        // must not stop the user from being deleted.
                        _logger.LogWarning(
                            "DeleteUser cleanup of {What} skipped: {Reason}",
                            what, cleanupEx.GetBaseException().Message);
                    }
                }

                if (userIntId is int uid)
                {
                    // Tenant DB — RBAC grants/overrides (keyed by the main-DB int
                    // id; cross-DB, so no FK cascade can ever clean them).
                    await TryCleanup(() => _dbContext.RbacTenantUserRoles.Where(r => r.UserId == uid).ExecuteDeleteAsync(), "RbacTenantUserRoles");
                    await TryCleanup(() => _dbContext.RbacTenantUserPermOverrides.Where(o => o.UserId == uid).ExecuteDeleteAsync(), "RbacTenantUserPermOverrides");

                    // Main DB — transient, user-owned auth/session/token rows that
                    // FK to the user (e.g. FK_UserSessions_AppUsers) and carry no
                    // standalone meaning once the user is gone.
                    await TryCleanup(() => _mainDb.UserSessions.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "UserSessions");
                    await TryCleanup(() => _mainDb.TemporaryLoginTokens.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "TemporaryLoginTokens");
                    await TryCleanup(() => _mainDb.PasswordResetTokens.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "PasswordResetTokens");
                    await TryCleanup(() => _mainDb.UserMfaSettings.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "UserMfaSettings");
                    await TryCleanup(() => _mainDb.MfaChallenges.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "MfaChallenges");
                    await TryCleanup(() => _mainDb.MfaOtpCodes.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "MfaOtpCodes");
                    await TryCleanup(() => _mainDb.MfaAttemptLogs.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "MfaAttemptLogs");
                    await TryCleanup(() => _mainDb.MfaTrustedDevices.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "MfaTrustedDevices");
                    await TryCleanup(() => _mainDb.AppUserGlobalRoles.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "AppUserGlobalRoles");
                    await TryCleanup(() => _mainDb.UserEnvironments.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "UserEnvironments");
                    await TryCleanup(() => _mainDb.UserTenantAssignments.Where(x => x.UserId == uid).ExecuteDeleteAsync(), "UserTenantAssignments");
                }

                // ── Delete the user rows themselves ──────────────────────────
                // Tenant DB: stores, then the web + legacy user rows.
                await _dbContext.WebUsersStores.Where(us => us.UserID == tenantUserId).ExecuteDeleteAsync();
                await _dbContext.UsersStores.Where(us => us.UserID == tenantUserId).ExecuteDeleteAsync();
                await _dbContext.WebUsers.Where(u => u.UserId == tenantUserId).ExecuteDeleteAsync();
                await _dbContext.Users.Where(u => u.UserId == tenantUserId).ExecuteDeleteAsync();

                // Main DB: the web + legacy user rows.
                if (userIntId is int parentUid)
                    await _mainDb.WebAppUsers.Where(a => a.UserId == parentUid).ExecuteDeleteAsync();

                await _mainDb.AppUsers.Where(a => a.LocalUserId == tenantUserId).ExecuteDeleteAsync();

                return ApiResponseFactory.Success(true, "User deleted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user: {TenantUserId}", tenantUserId);

                var detail = ex.GetBaseException().Message;

                // A foreign-key conflict means the user is still referenced by
                // records we intentionally don't cascade (e.g. activity/audit
                // history). Show a clear, friendly message for that case.
                if (detail.Contains("REFERENCE constraint", StringComparison.OrdinalIgnoreCase)
                    || detail.Contains("conflicted with the", StringComparison.OrdinalIgnoreCase))
                {
                    return ApiResponseFactory.BadRequest<bool>(
                        "This user can't be deleted because it's still in use by other records (such as activity history). Try deactivating the user instead.");
                }

                // Otherwise surface the real reason so the actual blocker stays
                // visible instead of hiding behind an opaque message.
                return ApiResponseFactory.InternalError<bool>($"Failed to delete user: {detail}");
            }
        }

        public async Task<ApiResponse<UserDetailDto>> GetUserByIdAsync(Guid tenantUserId)
        {
            try
            {
                var tenantUser = await _unitOfWorkTenant.WebUsers
                    .FirstOrDefaultAsync(u => u.UserId == tenantUserId);

                var appUser = await _unitOfWorkMain.WebAppUsers
                    .FirstOrDefaultAsync(a => a.LocalUserId == tenantUserId);

                if (tenantUser == null)
                {
                    if (appUser == null)
                        return ApiResponseFactory.NotFound<UserDetailDto>("User not found");

                    tenantUser = CloneAppUserToWebUser(appUser, tenantUserId, DateTime.UtcNow);
                    await _unitOfWorkTenant.WebUsers.AddAsync(tenantUser);
                    await _unitOfWorkTenant.SaveChangesAsync();

                    _logger.LogInformation("Synced user {UserId} from MainDB to TenantDB", tenantUserId);
                }

                var result = MapToDetailDto(tenantUser, appUser);
                result.AssignedStores = await GetUserStoreAssignmentsAsync(tenantUserId);

                var firstStoreAssignment = await _dbContext.WebUsersStores
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

        // ===========================================================================
        // Self-service profile (the /profile page)
        // ===========================================================================

        public async Task<ApiResponse<MyProfileDto>> GetMyProfileAsync(int userId)
        {
            try
            {
                // Resolved by primary key — unambiguous, always the exact caller.
                var webAppUser = await _mainDb.WebAppUsers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(a => a.UserId == userId);

                if (webAppUser == null)
                    return ApiResponseFactory.NotFound<MyProfileDto>("Profile not found");

                return ApiResponseFactory.Success(MapToMyProfileDto(webAppUser));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading own profile: {UserId}", userId);
                return ApiResponseFactory.InternalError<MyProfileDto>("Failed to load profile");
            }
        }

        public async Task<ApiResponse<MyProfileDto>> UpdateMyProfileAsync(int userId, UpdateMyProfileDto dto)
        {
            try
            {
                // Authoritative identity row, by primary key.
                var webAppUser = await _mainDb.WebAppUsers
                    .FirstOrDefaultAsync(a => a.UserId == userId);

                if (webAppUser == null)
                    return ApiResponseFactory.NotFound<MyProfileDto>("Profile not found");

                var localUserId = webAppUser.LocalUserId;

                // Email uniqueness — only when the user is actually changing it.
                // Compared case-insensitively; skipped when blank (blank = leave as-is).
                var newEmail = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
                if (newEmail != null &&
                    !string.Equals(newEmail, webAppUser.Email, StringComparison.OrdinalIgnoreCase))
                {
                    var duplicate = await _mainDb.WebAppUsers
                        .AsNoTracking()
                        .AnyAsync(u => u.Email != null
                                       && u.Email == newEmail
                                       && u.UserId != webAppUser.UserId);
                    if (duplicate)
                    {
                        return ApiResponseFactory.ValidationError<MyProfileDto>(
                            "A user with this email already exists.",
                            new Dictionary<string, List<string>>
                            {
                                ["Email"] = new() { "A user with this email already exists." }
                            });
                    }
                }

                var newPhone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
                var now = DateTime.UtcNow;

                // ── Main DB (authoritative) ─────────────────────────────────
                var legacyAppUser = await _mainDb.AppUsers
                    .FirstOrDefaultAsync(a => a.LocalUserId == localUserId);

                ApplyContactToAppUser(webAppUser, newEmail, newPhone, now);
                if (legacyAppUser != null)
                    ApplyContactToAppUser(legacyAppUser, newEmail, newPhone, now);

                await _mainDb.SaveChangesAsync();

                // ── Tenant DB (best-effort mirror) ──────────────────────────
                await MirrorToTenantAsync(localUserId, now, web => ApplyContactToTenantUser(web, newEmail, newPhone, now),
                                                              leg => ApplyContactToTenantUser(leg, newEmail, newPhone, now));

                return ApiResponseFactory.Success(MapToMyProfileDto(webAppUser), "Profile updated successfully");
            }
            catch (DbUpdateException dbex)
            {
                _logger.LogError(dbex, "DB error updating own profile: {UserId}", userId);
                return ApiResponseFactory.InternalError<MyProfileDto>(
                    "Failed to update profile: " + (dbex.InnerException?.Message ?? dbex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating own profile: {UserId}", userId);
                return ApiResponseFactory.InternalError<MyProfileDto>("Failed to update profile: " + ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> ChangeMyPasswordAsync(int userId, ChangePasswordDto dto)
        {
            try
            {
                if (string.IsNullOrEmpty(dto.NewPassword) || dto.NewPassword.Length < 6)
                    return ApiResponseFactory.BadRequest<bool>("New password must be at least 6 characters long.");

                if (dto.NewPassword != dto.ConfirmPassword)
                    return ApiResponseFactory.ValidationError<bool>(
                        "Passwords do not match.",
                        new Dictionary<string, List<string>> { ["ConfirmPassword"] = new() { "Passwords do not match." } });

                var webAppUser = await _mainDb.WebAppUsers
                    .FirstOrDefaultAsync(a => a.UserId == userId);

                if (webAppUser == null)
                    return ApiResponseFactory.NotFound<bool>("Profile not found");

                // Verify the current password. Prefer the BCrypt hash; fall back to
                // the legacy plaintext column for users not yet migrated to a hash.
                var currentOk = !string.IsNullOrEmpty(webAppUser.PasswordHash)
                    ? SafeVerify(dto.CurrentPassword, webAppUser.PasswordHash)
                    : !string.IsNullOrEmpty(webAppUser.Password) && webAppUser.Password == dto.CurrentPassword;

                if (!currentOk)
                    return ApiResponseFactory.ValidationError<bool>(
                        "Your current password is incorrect.",
                        new Dictionary<string, List<string>> { ["CurrentPassword"] = new() { "Your current password is incorrect." } });

                var localUserId = webAppUser.LocalUserId;
                var newHash = PasswordHelper.HashPassword(dto.NewPassword);
                var now = DateTime.UtcNow;

                // ── Main DB (authoritative) ─────────────────────────────────
                var legacyAppUser = await _mainDb.AppUsers
                    .FirstOrDefaultAsync(a => a.LocalUserId == localUserId);

                ApplyPasswordToAppUser(webAppUser, dto.NewPassword, newHash, now);
                if (legacyAppUser != null)
                    ApplyPasswordToAppUser(legacyAppUser, dto.NewPassword, newHash, now);

                await _mainDb.SaveChangesAsync();

                // ── Tenant DB (best-effort mirror) ──────────────────────────
                await MirrorToTenantAsync(localUserId, now, web => ApplyPasswordToTenantUser(web, dto.NewPassword, newHash, now),
                                                              leg => ApplyPasswordToTenantUser(leg, dto.NewPassword, newHash, now));

                return ApiResponseFactory.Success(true, "Password changed successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error changing password: {UserId}", userId);
                return ApiResponseFactory.InternalError<bool>("Failed to change password: " + ex.Message);
            }
        }

        public async Task<ApiResponse<string?>> UpdateProfileImageAsync(int userId, string? s3Path)
        {
            try
            {
                var webAppUser = await _mainDb.WebAppUsers
                    .FirstOrDefaultAsync(a => a.UserId == userId);

                if (webAppUser == null)
                    return ApiResponseFactory.NotFound<string?>("Profile not found");

                // Image lives ONLY on the app-user table — never mirrored elsewhere.
                webAppUser.ProfileImage = s3Path;
                webAppUser.DateModified = DateTime.UtcNow;
                await _mainDb.SaveChangesAsync();

                return ApiResponseFactory.Success<string?>(s3Path, "Profile image updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating profile image: {UserId}", userId);
                return ApiResponseFactory.InternalError<string?>("Failed to update profile image");
            }
        }

        private static bool SafeVerify(string password, string hash)
        {
            try { return PasswordHelper.VerifyPassword(password, hash); }
            catch { return false; } // malformed/legacy hash → treat as mismatch
        }

        /// <summary>
        /// Applies the given mutations to the tenant-DB WebUser / User mirror rows
        /// (whichever exist) and saves. Best-effort: a tenant context that can't be
        /// resolved never fails the caller — the authoritative main-DB write already
        /// landed.
        /// </summary>
        private async System.Threading.Tasks.Task MirrorToTenantAsync(
            Guid localUserId, DateTime now, Action<WebUser> applyWeb, Action<User> applyLegacy)
        {
            try
            {
                var webTenantUser = await _dbContext.WebUsers
                    .FirstOrDefaultAsync(u => u.UserId == localUserId);
                var legacyTenantUser = await _dbContext.Users
                    .FirstOrDefaultAsync(u => u.UserId == localUserId);

                if (webTenantUser != null) applyWeb(webTenantUser);
                if (legacyTenantUser != null) applyLegacy(legacyTenantUser);

                if (webTenantUser != null || legacyTenantUser != null)
                    await _dbContext.SaveChangesAsync();
            }
            catch (Exception tenantEx)
            {
                _logger.LogWarning(tenantEx,
                    "Tenant-side mirror update skipped for {LocalUserId}", localUserId);
            }
        }

        private static MyProfileDto MapToMyProfileDto(WebAppUser u) => new MyProfileDto
        {
            TenantUserId = u.LocalUserId,
            MainUserId = u.UserId,
            UserName = u.UserName,
            Email = u.Email,
            Phone = u.Phone,
            ProfileImagePath = u.ProfileImage
        };

        // ── Field-apply helpers (email/phone vs password kept separate) ──────
        // App-user rows carry the number in [Phone]; tenant rows in [HomePhoneNumber].
        private static void ApplyContactToAppUser(WebAppUser u, string? email, string? phone, DateTime now)
        {
            if (email != null) u.Email = email;
            if (phone != null) u.Phone = phone;
            u.DateModified = now;
        }

        private static void ApplyContactToAppUser(AppUser u, string? email, string? phone, DateTime now)
        {
            if (email != null) u.Email = email;
            if (phone != null) u.Phone = phone;
            u.DateModified = now;
        }

        private static void ApplyContactToTenantUser(WebUser u, string? email, string? phone, DateTime now)
        {
            if (email != null) u.Email = email;
            if (phone != null) u.HomePhoneNumber = phone;
            u.DateModified = now;
        }

        private static void ApplyContactToTenantUser(User u, string? email, string? phone, DateTime now)
        {
            if (email != null) u.Email = email;
            if (phone != null) u.HomePhoneNumber = phone;
            u.DateModified = now;
        }

        private static void ApplyPasswordToAppUser(WebAppUser u, string password, string passwordHash, DateTime now)
        {
            u.Password = password;
            u.PasswordHash = passwordHash;
            u.DateModified = now;
        }

        private static void ApplyPasswordToAppUser(AppUser u, string password, string passwordHash, DateTime now)
        {
            u.Password = password;
            u.PasswordHash = passwordHash;
            u.DateModified = now;
        }

        private static void ApplyPasswordToTenantUser(WebUser u, string password, string passwordHash, DateTime now)
        {
            u.Password = password;
            u.PasswordHash = passwordHash;
            u.DateModified = now;
        }

        private static void ApplyPasswordToTenantUser(User u, string password, string passwordHash, DateTime now)
        {
            u.Password = password;
            u.PasswordHash = passwordHash;
            u.DateModified = now;
        }

        // ===========================================================================
        // Builders / helpers
        // ===========================================================================

        /// <summary>
        /// Enforces email uniqueness across <c>WebAppUsers</c>. Returns null when the
        /// email is unique (or empty — empty emails skip the check, matching the
        /// existing DTO contract where Email is optional).
        ///
        /// Returns a populated <see cref="ApiResponse{T}"/> shaped as a validation error
        /// so the frontend's mapBackendErrors picks up the field-level "Email" key and
        /// highlights the input. Comparison is case-insensitive — SQL Server's default
        /// collation is case-insensitive, so EF translates this to a plain WHERE.
        /// </summary>
        private async Task<ApiResponse<UserDetailDto>?> ValidateEmailUniqueAsync(string? email, int? excludeUserId)
        {
            if (string.IsNullOrWhiteSpace(email)) return null;

            var trimmed = email.Trim();
            var duplicate = await _mainDb.WebAppUsers
                .AsNoTracking()
                .AnyAsync(u => u.Email != null
                               && u.Email == trimmed
                               && (excludeUserId == null || u.UserId != excludeUserId.Value));

            if (!duplicate) return null;

            return ApiResponseFactory.ValidationError<UserDetailDto>(
                "A user with this email already exists.",
                new Dictionary<string, List<string>>
                {
                    ["Email"] = new() { "A user with this email already exists." }
                });
        }

        /// <summary>
        /// Enforces UserName uniqueness within the current tenant DB. Mirrors the
        /// UNIQUE filtered index <c>idx_WebUserName</c> on <c>WebUsers.UserName</c>
        /// (rows where <c>Status &gt; -1</c>). Pre-checking here turns a SQL-level
        /// constraint violation into a clean field-level 400 response.
        /// </summary>
        private async Task<ApiResponse<UserDetailDto>?> ValidateUserNameUniqueAsync(string? userName, Guid? excludeTenantUserId)
        {
            if (string.IsNullOrWhiteSpace(userName)) return null;

            var trimmed = userName.Trim();
            var duplicate = await _dbContext.WebUsers
                .AsNoTracking()
                .AnyAsync(u => u.UserName == trimmed
                               && (u.Status == null || u.Status > -1)
                               && (excludeTenantUserId == null || u.UserId != excludeTenantUserId.Value));

            if (!duplicate) return null;

            return ApiResponseFactory.ValidationError<UserDetailDto>(
                "A user with this username already exists.",
                new Dictionary<string, List<string>>
                {
                    ["UserName"] = new() { "A user with this username already exists." }
                });
        }

        private static WebAppUser BuildWebAppUser(CreateUserDto dto, Guid sharedUserId, string passwordHash, int? customerId, DateTime now)
            => new WebAppUser
            {
                UserName = dto.UserName,
                Password = dto.Password,
                PasswordHash = passwordHash,
                Email = dto.Email,
                Phone = dto.HomePhoneNumber,
                LocalUserId = sharedUserId,
                CustomerId = customerId,
                DateCreated = now,
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

        private static AppUser BuildLegacyAppUser(CreateUserDto dto, Guid sharedUserId, string passwordHash, int? customerId, DateTime now)
            => new AppUser
            {
                UserName = dto.UserName,
                Password = dto.Password,
                PasswordHash = passwordHash,
                Email = dto.Email,
                Phone = dto.HomePhoneNumber,
                LocalUserId = sharedUserId,
                CustomerId = customerId,
                DateCreated = now,
                InviteStatus = 0,
                LoginType = "Email",
                UserFName = dto.UserFName,
                UserLName = dto.UserLName,
                Address = dto.Address,
                WorkPhoneNumber = dto.WorkPhoneNumber,
                Fax = dto.Fax,
                ZipCode = dto.ZipCode,
                Status = 1,
                HasWebAccess = true
            };

        private static WebUser BuildWebUser(CreateUserDto dto, Guid sharedUserId, string passwordHash, DateTime now)
            => new WebUser
            {
                UserId = sharedUserId,
                UserName = dto.UserName,
                Password = dto.Password,
                PasswordHash = passwordHash,
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
                DateCreated = now
            };

        private static User BuildLegacyTenantUser(CreateUserDto dto, Guid sharedUserId, string passwordHash, DateTime now)
            => new User
            {
                UserId = sharedUserId,
                UserName = dto.UserName,
                Password = dto.Password,
                PasswordHash = passwordHash,
                UserFName = dto.UserFName,
                UserLName = dto.UserLName,
                Email = dto.Email,
                Address = dto.Address,
                HomePhoneNumber = dto.HomePhoneNumber,
                WorkPhoneNumber = dto.WorkPhoneNumber,
                Fax = dto.Fax,
                ZipCode = dto.ZipCode,
                Status = 1,
                DateCreated = now
            };

        private static WebUser CloneAppUserToWebUser(WebAppUser appUser, Guid userId, DateTime now)
            => new WebUser
            {
                UserId = userId,
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
                DateCreated = now,
                ScanID = appUser.ScanID,
                IsLogIn = appUser.IsLogIn
            };

        /// <summary>
        /// One-shot Stores SELECT to build the response DTO list. Used by both create
        /// and update so the caller never pays for two queries (delete-and-rewrite
        /// would otherwise force a re-read).
        /// </summary>
        private async Task<List<UserStoreAssignmentDto>> BuildStoreAssignmentDtosAsync(List<Guid> storeIds, Guid? defaultStoreId)
        {
            if (storeIds == null || storeIds.Count == 0)
                return new List<UserStoreAssignmentDto>();

            var stores = await _dbContext.Stores
                .Where(s => storeIds.Contains(s.StoreID))
                .Select(s => new { s.StoreID, s.StoreName })
                .ToListAsync();

            return stores
                .Select(s => new UserStoreAssignmentDto
                {
                    StoreId = s.StoreID,
                    StoreName = s.StoreName ?? string.Empty,
                    IsDefault = s.StoreID == defaultStoreId,
                    IsManager = false
                })
                .ToList();
        }

        private async Task<List<UserStoreAssignmentDto>> GetUserStoreAssignmentsAsync(Guid userId)
        {
            return await _dbContext.WebUsersStores
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

        private static void ApplyDtoToTenantUser(WebUser u, UpdateUserDto dto, string? passwordHash, DateTime now)
        {
            u.UserName = dto.UserName;
            u.UserFName = dto.UserFName;
            u.UserLName = dto.UserLName;
            u.Email = dto.Email;
            u.Address = dto.Address;
            u.HomePhoneNumber = dto.HomePhoneNumber;
            u.WorkPhoneNumber = dto.WorkPhoneNumber;
            u.Fax = dto.Fax;
            u.ZipCode = dto.ZipCode;
            u.IsSuperAdmin = dto.IsSuperAdmin;
            u.DateModified = now;

            if (!string.IsNullOrEmpty(dto.Password))
            {
                u.Password = dto.Password;
                u.PasswordHash = passwordHash;
            }
        }

        private static void ApplyDtoToTenantUser(User u, UpdateUserDto dto, string? passwordHash, DateTime now)
        {
            u.UserName = dto.UserName;
            u.UserFName = dto.UserFName;
            u.UserLName = dto.UserLName;
            u.Email = dto.Email;
            u.Address = dto.Address;
            u.HomePhoneNumber = dto.HomePhoneNumber;
            u.WorkPhoneNumber = dto.WorkPhoneNumber;
            u.Fax = dto.Fax;
            u.ZipCode = dto.ZipCode;
            u.DateModified = now;

            if (!string.IsNullOrEmpty(dto.Password))
            {
                u.Password = dto.Password;
                u.PasswordHash = passwordHash;
            }
        }

        private static void ApplyDtoToAppUser(WebAppUser u, UpdateUserDto dto, string? passwordHash, DateTime now)
        {
            u.UserName = dto.UserName;
            u.Email = dto.Email;
            u.Phone = dto.HomePhoneNumber;
            u.UserFName = dto.UserFName;
            u.UserLName = dto.UserLName;
            u.Address = dto.Address;
            u.WorkPhoneNumber = dto.WorkPhoneNumber;
            u.Fax = dto.Fax;
            u.ZipCode = dto.ZipCode;
            u.IsSuperAdmin = dto.IsSuperAdmin;
            u.DateModified = now;

            if (!string.IsNullOrEmpty(dto.Password))
            {
                u.Password = dto.Password;
                u.PasswordHash = passwordHash;
            }
        }

        private static void ApplyDtoToAppUser(AppUser u, UpdateUserDto dto, string? passwordHash, DateTime now)
        {
            u.UserName = dto.UserName;
            u.Email = dto.Email;
            u.Phone = dto.HomePhoneNumber;
            u.UserFName = dto.UserFName;
            u.UserLName = dto.UserLName;
            u.Address = dto.Address;
            u.WorkPhoneNumber = dto.WorkPhoneNumber;
            u.Fax = dto.Fax;
            u.ZipCode = dto.ZipCode;
            u.DateModified = now;

            if (!string.IsNullOrEmpty(dto.Password))
            {
                u.Password = dto.Password;
                u.PasswordHash = passwordHash;
            }
        }

        private static UserDetailDto MapToDetailDto(WebUser tenantUser, WebAppUser? appUser)
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
