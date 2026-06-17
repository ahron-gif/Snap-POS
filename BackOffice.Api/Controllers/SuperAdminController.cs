using BackOffice.Application.Configuration;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Main.UserTenantAssignment;
using BackOffice.Application.DTOs.Mian.License;
using BackOffice.Application.Extensions;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.Security;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Enums;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SuperAdminController : ControllerBase
    {
        private readonly MainDBContext _mainDb;
        private readonly IUserTenantAssignmentService _tenantAssignmentService;
        private readonly ITenantPermissionService _tenantPermissionService;
        private readonly ITenantRbacService _tenantRbacService;
        private readonly IPasswordCipher _passwordCipher;
        private readonly ILicenseService _licenseService;
        private readonly ILogger<SuperAdminController> _logger;
        private readonly Guid _currentEnvironmentId;

        public SuperAdminController(
            MainDBContext mainDb,
            IUserTenantAssignmentService tenantAssignmentService,
            ITenantPermissionService tenantPermissionService,
            ITenantRbacService tenantRbacService,
            IPasswordCipher passwordCipher,
            ILicenseService licenseService,
            ILogger<SuperAdminController> logger,
            EnvironmentSettings environmentSettings)
        {
            _mainDb = mainDb;
            _tenantAssignmentService = tenantAssignmentService;
            _tenantPermissionService = tenantPermissionService;
            _tenantRbacService = tenantRbacService;
            _passwordCipher = passwordCipher;
            _licenseService = licenseService;
            _logger = logger;
            _currentEnvironmentId = environmentSettings.CurrentEnvironmentId;
        }

        /// <summary>
        /// Returns paginated list of tenants (Master DB Customers) with plan info.
        /// Only SuperAdmin users (CustomerId == null) should call this.
        /// </summary>
        [HttpGet("Tenants")]
        public IActionResult GetTenants([FromQuery] PaginationGridDto grid)
        {
            // Verify caller is SuperAdmin
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            var query = _mainDb.Customers
                .Where(c => c.IsActive && (_currentEnvironmentId == Guid.Empty || c.EnvironmentId == _currentEnvironmentId))
                .Include(c => c.Subscription).ThenInclude(s => s!.Plan)
                .AsNoTracking()
                .Select(c => new TenantListItemDto
                {
                    Id = c.CustomerId,
                    CustomerName = c.CustomerName,
                    Email = c.Email ?? c.ContactEmail ?? "",
                    PlanId = c.Subscription != null ? c.Subscription.PlanId : (int?)null,
                    PlanName = c.Subscription != null && c.Subscription.Plan != null ? c.Subscription.Plan.Name : null,
                    MaxConcurrentUsers = c.MaxConcurrentUsers,
                    ExpiresAt = c.ExpiresAt,
                    IsActive = c.ExpiresAt == null || c.ExpiresAt > DateTime.UtcNow,
                    DateCreated = c.DateCreated
                });

            // Search filter
            if (!string.IsNullOrWhiteSpace(grid.CustomGridSearchText))
            {
                var search = grid.CustomGridSearchText.Trim().ToLower();
                query = query.Where(t =>
                    t.CustomerName.ToLower().Contains(search) ||
                    (t.Email != null && t.Email.ToLower().Contains(search)) ||
                    (t.PlanName != null && t.PlanName.ToLower().Contains(search)));
            }

            var totalRecords = _mainDb.Customers.Count(c => c.IsActive && (_currentEnvironmentId == Guid.Empty || c.EnvironmentId == _currentEnvironmentId));
            var filteredRecords = query.Count();

            // Sort
            query = (grid.SortColumn?.ToLower()) switch
            {
                "customername" => grid.SortDirection?.ToLower() == "asc"
                    ? query.OrderBy(t => t.CustomerName)
                    : query.OrderByDescending(t => t.CustomerName),
                "email" => grid.SortDirection?.ToLower() == "asc"
                    ? query.OrderBy(t => t.Email)
                    : query.OrderByDescending(t => t.Email),
                "planname" => grid.SortDirection?.ToLower() == "asc"
                    ? query.OrderBy(t => t.PlanName)
                    : query.OrderByDescending(t => t.PlanName),
                _ => query.OrderByDescending(t => t.DateCreated)
            };

            var data = query
                .Skip(grid.StartRow)
                .Take(grid.EndRow - grid.StartRow)
                .ToList();

            return Ok(new ApiResponse<PaginationResponseDTO<TenantListItemDto>>
            {
                IsSuccess = true,
                Response = new PaginationResponseDTO<TenantListItemDto>
                {
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    Data = data
                }
            });
        }

        // ─── Master Customer (RDT Cloud DB) CRUD ─────────────────────────

        /// <summary>
        /// Paginated list of master customers with full DB connection info.
        /// </summary>
        [HttpGet("Customers")]
        public IActionResult GetMasterCustomers([FromQuery] PaginationGridDto grid)
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            var query = _mainDb.Customers
                .Where(c => c.IsActive && (_currentEnvironmentId == Guid.Empty || c.EnvironmentId == _currentEnvironmentId))
                .AsNoTracking();

            // Search
            if (!string.IsNullOrWhiteSpace(grid.CustomGridSearchText))
            {
                var search = grid.CustomGridSearchText.Trim().ToLower();
                query = query.Where(c =>
                    c.CustomerName.ToLower().Contains(search) ||
                    c.DBName.ToLower().Contains(search) ||
                    (c.Email != null && c.Email.ToLower().Contains(search)) ||
                    c.ServerName.ToLower().Contains(search));
            }

            var totalRecords = _mainDb.Customers.Count(c => c.IsActive && (_currentEnvironmentId == Guid.Empty || c.EnvironmentId == _currentEnvironmentId));
            var filteredRecords = query.Count();

            // Sort
            query = (grid.SortColumn?.ToLower()) switch
            {
                "customername" => grid.SortDirection?.ToLower() == "asc"
                    ? query.OrderBy(c => c.CustomerName)
                    : query.OrderByDescending(c => c.CustomerName),
                "dbname" => grid.SortDirection?.ToLower() == "asc"
                    ? query.OrderBy(c => c.DBName)
                    : query.OrderByDescending(c => c.DBName),
                "datecreated" => grid.SortDirection?.ToLower() == "asc"
                    ? query.OrderBy(c => c.DateCreated)
                    : query.OrderByDescending(c => c.DateCreated),
                _ => query.OrderByDescending(c => c.DateCreated)
            };

            var data = query
                .Include(c => c.Subscription)
                .Skip(grid.StartRow)
                .Take(grid.EndRow - grid.StartRow)
                .Select(c => new MasterCustomerDto
                {
                    CustomerId = c.CustomerId,
                    CustomerName = c.CustomerName,
                    ServerName = c.ServerName,
                    DBName = c.DBName,
                    DBUser = c.DBUser,
                    // WEB-152: never return the tenant DB password to the UI.
                    // The encrypted value lives on Customer.DBPasswordSecure and
                    // is only consumed server-side at connection-string time.
                    DBPass = string.Empty,
                    DateCreated = c.DateCreated,
                    DateModified = c.DateModified,
                    SystemUserCreated = c.SystemUserCreated,
                    LicenseKey = c.LicenseKey.ToString(),
                    Email = c.Email,
                    Environment = c.Environment,
                    MaxConcurrentUsers = c.MaxConcurrentUsers,
                    PlanId = c.Subscription != null ? c.Subscription.PlanId : (int?)null,
                    ExpiresAt = c.ExpiresAt,
                    ContactEmail = c.ContactEmail,
                    ContactPhone = c.ContactPhone
                })
                .ToList();

            return Ok(new ApiResponse<PaginationResponseDTO<MasterCustomerDto>>
            {
                IsSuccess = true,
                Response = new PaginationResponseDTO<MasterCustomerDto>
                {
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    Data = data
                }
            });
        }

        [HttpGet("Customers/{id:int}")]
        public async Task<IActionResult> GetMasterCustomerById(int id)
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            var c = await _mainDb.Customers
                .Include(c => c.Subscription)
                .FirstOrDefaultAsync(c => c.CustomerId == id);
            if (c == null)
            {
                return NotFound(new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = "Customer not found"
                });
            }

            // WEB-152: single-customer GET returns the *decrypted* password so the SuperAdmin
            // edit form can pre-fill it (UI shows it behind a password-type input with an eye
            // toggle). The list endpoint above still masks it — that's where bulk exposure was
            // the real concern. If decryption fails (e.g., legacy bad data), fall back gracefully.
            string decryptedPassword;
            try
            {
                decryptedPassword = c.ResolveDBPassword(_passwordCipher);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to decrypt DBPasswordSecure for customer {CustomerId}; returning empty.",
                    c.CustomerId);
                decryptedPassword = string.Empty;
            }

            var dto = new MasterCustomerDto
            {
                CustomerId = c.CustomerId,
                CustomerName = c.CustomerName,
                ServerName = c.ServerName,
                DBName = c.DBName,
                DBUser = c.DBUser,
                DBPass = decryptedPassword,
                DateCreated = c.DateCreated,
                DateModified = c.DateModified,
                SystemUserCreated = c.SystemUserCreated,
                LicenseKey = c.LicenseKey.ToString(),
                Email = c.Email,
                Environment = c.Environment,
                MaxConcurrentUsers = c.MaxConcurrentUsers,
                PlanId = c.Subscription?.PlanId,
                ExpiresAt = c.ExpiresAt,
                ContactEmail = c.ContactEmail,
                ContactPhone = c.ContactPhone
            };

            return Ok(new ApiResponse<MasterCustomerDto>
            {
                IsSuccess = true,
                Response = dto
            });
        }

        [HttpPost("Customers")]
        public async Task<IActionResult> CreateMasterCustomer([FromBody] MasterCustomerDto? dto)
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            if (dto == null ||
                string.IsNullOrWhiteSpace(dto.CustomerName) ||
                string.IsNullOrWhiteSpace(dto.ServerName) ||
                string.IsNullOrWhiteSpace(dto.DBName) ||
                string.IsNullOrWhiteSpace(dto.DBUser) ||
                string.IsNullOrWhiteSpace(dto.DBPass))
            {
                return BadRequest(new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = "CustomerName, ServerName, DBName, DBUser and DBPass are required."
                });
            }

            // Resolve SystemUserCreated (default to current user if available)
            var currentUserId = GetUserIdFromClaims();

            // Parse or generate license key
            Guid licenseGuid;
            if (!Guid.TryParse(dto.LicenseKey, out licenseGuid))
            {
                licenseGuid = Guid.NewGuid();
            }

            // WEB-152: encrypt the password into DBPasswordSecure (authoritative for this app)
            // and keep writing the plaintext to DBPass so the legacy old BackOffice still works.
            var encryptedPassword = _passwordCipher.Encrypt(dto.DBPass);

            var customer = new Customer
            {
                CustomerName = dto.CustomerName,
                ServerName = dto.ServerName,
                DBName = dto.DBName,
                DBUser = dto.DBUser,
                DBPass = dto.DBPass,
                DBPasswordSecure = encryptedPassword,
                DateCreated = DateTime.UtcNow,
                DateModified = null,
                SystemUserCreated = dto.SystemUserCreated ?? (currentUserId > 0 ? currentUserId : (int?)null),
                LicenseKey = licenseGuid,
                Email = dto.Email,
                Environment = dto.Environment,
                MaxConcurrentUsers = dto.MaxConcurrentUsers,
                ExpiresAt = dto.ExpiresAt,
                ContactEmail = dto.ContactEmail,
                ContactPhone = dto.ContactPhone,
                EnvironmentId = _currentEnvironmentId != Guid.Empty ? _currentEnvironmentId : null,
                IsActive = true
            };

            _mainDb.Customers.Add(customer);
            await _mainDb.SaveChangesAsync();

            // Create subscription if a PlanId was provided
            if (dto.PlanId.HasValue)
            {
                var subscription = new Subscription
                {
                    CustomerId = customer.CustomerId,
                    PlanId = dto.PlanId.Value,
                    Status = SubscriptionStatus.Active,
                    StartDate = DateTime.UtcNow,
                    BillingCycleMonths = 1
                };
                _mainDb.Subscriptions.Add(subscription);
                await _mainDb.SaveChangesAsync();
            }

            // ── Auto-onboard: seed permission ceiling + initialize admin role ──
            try
            {
                // Step 1: Seed all active permissions & modules in the tenant ceiling
                var ceilingResult = await _tenantPermissionService
                    .EnableAllPermissionsForTenantAsync(customer.CustomerId, currentUserId > 0 ? currentUserId : 0);

                if (ceilingResult.IsSuccess)
                {
                    _logger.LogInformation(
                        "Auto-onboard: seeded permission ceiling for new tenant {TenantId} ({TenantName})",
                        customer.CustomerId, customer.CustomerName);
                }
                else
                {
                    _logger.LogWarning(
                        "Auto-onboard: failed to seed ceiling for tenant {TenantId}: {Msg}",
                        customer.CustomerId, ceilingResult.Message);
                }

                // Step 2: Initialize Administrator role + assign all ceiling permissions in Tenant DB
                //         (this also creates the admin role if the RBAC tables exist)
                var rbacResult = await _tenantRbacService
                    .InitializeAdminRoleAsync(customer.CustomerId, adminUserId: null);

                if (rbacResult.IsSuccess)
                {
                    _logger.LogInformation(
                        "Auto-onboard: initialized admin role for new tenant {TenantId} ({TenantName})",
                        customer.CustomerId, customer.CustomerName);
                }
                else
                {
                    _logger.LogWarning(
                        "Auto-onboard: failed to initialize admin role for tenant {TenantId}: {Msg}. " +
                        "This is expected if the tenant DB hasn't been provisioned yet. " +
                        "Run RBAC_TenantDB_Schema.sql on the tenant DB, then call POST /api/TenantRbac/InitializeAdmin.",
                        customer.CustomerId, rbacResult.Message);
                }
            }
            catch (Exception ex)
            {
                // Don't fail the whole customer creation if onboarding has issues
                _logger.LogError(ex,
                    "Auto-onboard: error during RBAC onboarding for new tenant {TenantId}. " +
                    "Customer was created successfully. RBAC can be set up manually.",
                    customer.CustomerId);
            }

            return Ok(new ApiResponse<int>
            {
                IsSuccess = true,
                Response = customer.CustomerId
            });
        }

        [HttpPut("Customers/{id:int}")]
        public async Task<IActionResult> UpdateMasterCustomer(int id, [FromBody] MasterCustomerDto? dto)
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            var customer = await _mainDb.Customers
                .Include(c => c.Subscription)
                .FirstOrDefaultAsync(c => c.CustomerId == id);
            if (customer == null)
            {
                return NotFound(new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = "Customer not found"
                });
            }
            if (dto == null)
            {
                return BadRequest(new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = "Request body is required."
                });
            }

            customer.CustomerName = dto.CustomerName;
            customer.ServerName = dto.ServerName;
            customer.DBName = dto.DBName;
            customer.DBUser = dto.DBUser;
            // WEB-152: GET never returns the password, so the UI sends a non-empty value
            // only when the user actually typed a new one. Empty means "leave password
            // unchanged" — preserves both the legacy DBPass and the encrypted column.
            if (!string.IsNullOrWhiteSpace(dto.DBPass))
            {
                customer.DBPass = dto.DBPass;
                customer.DBPasswordSecure = _passwordCipher.Encrypt(dto.DBPass);
            }
            customer.DateModified = DateTime.UtcNow;
            if (dto.SystemUserCreated.HasValue)
            {
                customer.SystemUserCreated = dto.SystemUserCreated.Value;
            }
            if (!string.IsNullOrWhiteSpace(dto.LicenseKey) && Guid.TryParse(dto.LicenseKey, out var updatedLicense))
            {
                customer.LicenseKey = updatedLicense;
            }
            customer.Email = dto.Email;
            customer.Environment = dto.Environment;
            customer.MaxConcurrentUsers = dto.MaxConcurrentUsers;
            customer.ExpiresAt = dto.ExpiresAt;
            customer.ContactEmail = dto.ContactEmail;
            customer.ContactPhone = dto.ContactPhone;

            // Update or create subscription based on PlanId
            if (dto.PlanId.HasValue)
            {
                if (customer.Subscription != null)
                {
                    customer.Subscription.PlanId = dto.PlanId.Value;
                }
                else
                {
                    customer.Subscription = new Subscription
                    {
                        CustomerId = customer.CustomerId,
                        PlanId = dto.PlanId.Value,
                        Status = SubscriptionStatus.Active,
                        StartDate = DateTime.UtcNow,
                        BillingCycleMonths = 1
                    };
                }
            }

            await _mainDb.SaveChangesAsync();

            return Ok(new ApiResponse<bool>
            {
                IsSuccess = true,
                Response = true
            });
        }

        [HttpDelete("Customers/{id:int}")]
        public async Task<IActionResult> DeleteMasterCustomer(int id)
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            var customer = await _mainDb.Customers.FindAsync(id);
            if (customer == null)
            {
                return NotFound(new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = "Customer not found"
                });
            }

            _mainDb.Customers.Remove(customer);
            await _mainDb.SaveChangesAsync();

            return Ok(new ApiResponse<bool>
            {
                IsSuccess = true,
                Response = true
            });
        }

        /// <summary>
        /// WEB-152: One-time backfill — encrypt every existing customer's
        /// plaintext <c>DBPass</c> into the new <c>DBPasswordSecure</c> column.
        /// </summary>
        /// <remarks>
        /// Idempotent: skips customers whose <c>DBPasswordSecure</c> already has a value,
        /// so running it more than once is safe and a no-op for already-migrated rows.
        /// To force re-encryption of a specific customer, clear the column first
        /// (UPDATE Customers SET DBPasswordSecure = NULL WHERE CustomerId = ...).
        ///
        /// Skips customers with empty <c>DBPass</c> — nothing useful to encrypt there.
        ///
        /// Returns <c>{ updated, skippedAlreadyEncrypted, skippedEmptyPassword }</c>
        /// so the caller can verify what happened.
        /// </remarks>
        [HttpPost("Customers/BackfillEncryptedPasswords")]
        public async Task<IActionResult> BackfillEncryptedPasswords()
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            var customers = await _mainDb.Customers.ToListAsync();

            var updated = 0;
            var skippedAlreadyEncrypted = 0;
            var skippedEmptyPassword = 0;
            var failed = new List<int>();

            foreach (var customer in customers)
            {
                if (!string.IsNullOrEmpty(customer.DBPasswordSecure))
                {
                    skippedAlreadyEncrypted++;
                    continue;
                }
                if (string.IsNullOrEmpty(customer.DBPass))
                {
                    skippedEmptyPassword++;
                    continue;
                }

                try
                {
                    customer.DBPasswordSecure = _passwordCipher.Encrypt(customer.DBPass);
                    customer.DateModified = DateTime.UtcNow;
                    updated++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Failed to encrypt DBPass for customer {CustomerId}; skipping.",
                        customer.CustomerId);
                    failed.Add(customer.CustomerId);
                }
            }

            await _mainDb.SaveChangesAsync();

            _logger.LogInformation(
                "Backfill of DBPasswordSecure complete. Updated={Updated}, AlreadyEncrypted={SkippedEnc}, EmptyPassword={SkippedEmpty}, Failed={FailedCount}",
                updated, skippedAlreadyEncrypted, skippedEmptyPassword, failed.Count);

            return Ok(new ApiResponse<object>
            {
                IsSuccess = true,
                Message = $"Backfill complete. Encrypted {updated} customer(s).",
                Response = new
                {
                    updated,
                    skippedAlreadyEncrypted,
                    skippedEmptyPassword,
                    failedCustomerIds = failed
                }
            });
        }

        // ─── License Setup (per-tenant encrypted EncData blob) ───────────

        /// <summary>
        /// Returns the decrypted license / setup blob for the given tenant.
        /// Mirrors the desktop FrmStartWz "RDT Systems Installation Setup"
        /// form. SuperAdmin-only.
        /// </summary>
        [HttpGet("Customers/{id:int}/license")]
        public async Task<IActionResult> GetCustomerLicense(int id, CancellationToken ct)
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            try
            {
                var license = await _licenseService.GetLicenseAsync(id, ct);
                if (license is null)
                {
                    return NotFound(new ApiResponse<string>
                    {
                        IsSuccess = false,
                        Message = "Tenant has no license/EncData row yet."
                    });
                }

                return Ok(new ApiResponse<LicenseDto>
                {
                    IsSuccess = true,
                    Response = license
                });
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "License lookup failed for Customer {CustomerId}.", id);
                return NotFound(new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "License GET failed for Customer {CustomerId}.", id);
                // SuperAdmin-only endpoint — return the real error message so
                // the operator can diagnose without log access. Includes the
                // inner exception chain because EF/SqlClient nest the actual
                // cause one level down.
                return StatusCode(500, new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = $"License load failed: {ex.GetType().Name}: {ex.Message}" +
                              (ex.InnerException is not null
                                  ? $" → {ex.InnerException.GetType().Name}: {ex.InnerException.Message}"
                                  : string.Empty)
                });
            }
        }

        /// <summary>
        /// Updates the license / setup blob for the given tenant. The service
        /// loads the existing decrypted XML first so unknown / legacy fields
        /// survive. SuperAdmin-only.
        /// </summary>
        [HttpPut("Customers/{id:int}/license")]
        public async Task<IActionResult> UpdateCustomerLicense(
            int id, [FromBody] LicenseDto? dto, CancellationToken ct)
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            if (dto is null)
            {
                return BadRequest(new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = "Request body is required."
                });
            }

            try
            {
                await _licenseService.UpdateLicenseAsync(id, dto, ct);
                return Ok(new ApiResponse<string>
                {
                    IsSuccess = true,
                    Message = "License updated."
                });
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "License update failed for Customer {CustomerId}.", id);
                return NotFound(new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "License PUT failed for Customer {CustomerId}.", id);
                return StatusCode(500, new ApiResponse<string>
                {
                    IsSuccess = false,
                    Message = $"License save failed: {ex.GetType().Name}: {ex.Message}" +
                              (ex.InnerException is not null
                                  ? $" → {ex.InnerException.GetType().Name}: {ex.InnerException.Message}"
                                  : string.Empty)
                });
            }
        }

        // ─── User-Tenant Assignment ─────────────────────

        [HttpGet("Users/{userId}/Tenants")]
        public async Task<IActionResult> GetUserTenantAssignments(int userId)
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            var result = await _tenantAssignmentService.GetTenantAssignmentsForUserAsync(userId);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        [HttpPut("Users/{userId}/Tenants")]
        public async Task<IActionResult> AssignTenantsToUser(int userId, [FromBody] AssignTenantsToUserDto dto)

        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
                return Forbid();

            if (userId != dto.UserId)
                return BadRequest("User ID mismatch");

            var assignedBy = GetUserIdFromClaims();
            if (assignedBy <= 0) return Unauthorized();

            var result = await _tenantAssignmentService.AssignTenantsToUserAsync(dto, assignedBy);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        [HttpGet("MyTenants")]
        public async Task<IActionResult> GetMyTenants()
        {
            var userId = GetUserIdFromClaims();
            if (userId <= 0) return Unauthorized();

            var result = await _tenantAssignmentService.GetMyAssignedTenantsAsync(userId);
            if (!result.IsSuccess)
                return StatusCode((int)result.StatusCode, result);
            return Ok(result);
        }

        // ─── Private Helpers ──────────────────────────

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }
    }

    // ─── DTO ──────────────────────────────────────────────────────────────
    public class TenantListItemDto
    {
        public int Id { get; set; }
        public string CustomerName { get; set; } = null!;
        public string? Email { get; set; }
        public int? PlanId { get; set; }
        public string? PlanName { get; set; }
        public int MaxConcurrentUsers { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public bool IsActive { get; set; }
        public DateTime DateCreated { get; set; }
    }

    public class MasterCustomerDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = null!;
        public string ServerName { get; set; } = null!;
        public string DBName { get; set; } = null!;
        public string DBUser { get; set; } = null!;
        public string DBPass { get; set; } = null!;
        public DateTime DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public int? SystemUserCreated { get; set; }
        // For JSON we accept any string; backend will parse or generate Guid.
        public string? LicenseKey { get; set; }
        public string? Email { get; set; }
        public int Environment { get; set; }
        public int MaxConcurrentUsers { get; set; }
        public int? PlanId { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public string? ContactEmail { get; set; }
        public string? ContactPhone { get; set; }
    }
}