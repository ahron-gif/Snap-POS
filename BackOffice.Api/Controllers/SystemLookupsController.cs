using BackOffice.Application.DTOs.Tenant.Lookup;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SystemLookupsController : ControllerBase
    {
        private readonly ISystemLookupService _systemLookupService;
        private readonly ICustomerService _customerService;
        private readonly IVendorService _vendorService;
        private readonly ISupplierService _supplierService;
        private readonly IUnitOfWorkMain _unitOfWorkMain;

        public SystemLookupsController(
            ISystemLookupService systemLookupService,
            ICustomerService customerService,
            IVendorService vendorService,
            ISupplierService supplierService,
            IUnitOfWorkMain unitOfWorkMain)
        {
            _systemLookupService = systemLookupService;
            _customerService = customerService;
            _vendorService = vendorService;
            _supplierService = supplierService;
            _unitOfWorkMain = unitOfWorkMain;
        }

        /// <summary>
        /// Get all item types for dropdown
        /// </summary>
        [HttpGet("ItemTypes")]
        public async Task<IActionResult> GetItemTypes()
        {
            var result = await _systemLookupService.GetItemTypesAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get all barcode types for dropdown
        /// </summary>
        [HttpGet("BarcodeTypes")]
        public async Task<IActionResult> GetBarcodeTypes()
        {
            var result = await _systemLookupService.GetBarcodeTypesAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get all UOM types for dropdown (Unit of Measure - Cases, Units, etc.)
        /// </summary>
        [HttpGet("UOMTypes")]
        public async Task<IActionResult> GetUOMTypes()
        {
            var result = await _systemLookupService.GetUOMTypesAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get all measure types for dropdown (Each, Pound, Ounce, etc.)
        /// </summary>
        [HttpGet("MeasureTypes")]
        public async Task<IActionResult> GetMeasureTypes()
        {
            var result = await _systemLookupService.GetMeasureTypesAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get all departments for dropdown (hierarchical tree structure)
        /// Returns DepartmentStoreID, Name, and ParentDepartmentID for tree building
        /// </summary>
        [HttpGet("Departments")]
        public async Task<IActionResult> GetDepartments()
        {
            var result = await _systemLookupService.GetDepartmentsAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get all items lookup values for dropdowns (Manufacturer, Pattern, Custom Fields)
        /// ValueType: 0=Pattern, 1-10=CustomField1-10, 11=Manufacturer
        /// </summary>
        /// <param name="valueType">Optional filter by value type</param>
        [HttpGet("ItemsLookupValues")]
        public async Task<IActionResult> GetItemsLookupValues([FromQuery] short? valueType = null)
        {
            var result = await _systemLookupService.GetItemsLookupValuesAsync(valueType);
            return Ok(result);
        }

        /// <summary>
        /// Get all extra charge items for dropdown (Extra Charge 1, 2, 3)
        /// Uses SP_GetExtraChargeItems stored procedure
        /// </summary>
        /// <param name="storeId">The store ID to filter items</param>
        [HttpGet("ExtraChargeItems")]
        public async Task<IActionResult> GetExtraChargeItems([FromQuery] Guid storeId)
        {
            var result = await _systemLookupService.GetExtraChargeItemsAsync(storeId);
            return Ok(result);
        }

        /// <summary>
        /// Get all app items for App Button dropdown in Item form Extra tab
        /// Uses SP_GetAppItems stored procedure
        /// </summary>
        [HttpGet("AppItems")]
        public async Task<IActionResult> GetAppItems()
        {
            var result = await _systemLookupService.GetAppItemsAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get all tax rates for the Tax dropdown next to Taxable checkbox
        /// </summary>
        [HttpGet("Taxes")]
        public async Task<IActionResult> GetTaxes()
        {
            var result = await _systemLookupService.GetTaxesAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get all stores for dropdown (from SP_GetStoresByUser)
        /// Used to populate Store dropdown in Item form header
        /// </summary>
        /// <param name="userId">The user ID to filter stores</param>
        /// <param name="storeId">Optional current store ID</param>
        [HttpGet("Stores")]
        public async Task<IActionResult> GetStoresByUser([FromQuery] Guid userId, [FromQuery] Guid? storeId = null)
        {
            var result = await _systemLookupService.GetStoresByUserAsync(userId, storeId);
            return Ok(result);
        }

        /// <summary>
        /// Get all stores for dropdown by user (with customer context for login flow)
        /// Resolves the correct localUserId for the target customer from the MainDB AppUsers table
        /// </summary>
        /// <param name="userId">The user ID (localUserId) from the login tenant — used as fallback</param>
        /// <param name="customerId">The customer ID to establish tenant context (used by middleware)</param>
        [HttpGet("StoresByUser")]
        public async Task<IActionResult> GetStoresByUserWithCustomer([FromQuery] Guid userId, [FromQuery] int customerId)
        {
            var resolvedUserId = userId;

            var emailClaim = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
            var userNameClaim = User.FindFirst("UserName")?.Value
                                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;

            if (!string.IsNullOrEmpty(emailClaim))
            {
                var appUser = await _unitOfWorkMain.WebAppUsers
                    .FirstOrDefaultAsync(a => a.Email == emailClaim);
                if (appUser != null)
                    resolvedUserId = appUser.LocalUserId;
            }
            else if (!string.IsNullOrEmpty(userNameClaim))
            {
                var appUser = await _unitOfWorkMain.WebAppUsers
                    .FirstOrDefaultAsync(a => a.UserName == userNameClaim);
                if (appUser != null)
                    resolvedUserId = appUser.LocalUserId;
            }

            var result = await _systemLookupService.GetStoresByUserAsync(resolvedUserId, null);
            return Ok(result);
        }

        /// <summary>
        /// Get all customers for lookup dropdown (ID and Name only)
        /// Used for report filters and other dropdowns
        /// </summary>
        [HttpGet("Customers")]
        public IActionResult GetCustomersLookup()
        {
            var result = _customerService.GetAllCustomersLookupAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get all vendors for lookup dropdown (ID and Name only)
        /// Used for report filters and other dropdowns
        /// </summary>
        [HttpGet("Vendors")]
        public IActionResult GetVendorsLookup()
        {
            var result = _vendorService.GetAllVendorsLookupAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get all suppliers for lookup dropdown (SupplierID, Name, SupplierNo) from Supplier table – same as desktop SP_GetSupplierView / SuppliersGate.SupplierDS
        /// Used for report filters (e.g. Items on Purchase Order) and other dropdowns
        /// </summary>
        [HttpGet("Suppliers")]
        public IActionResult GetSuppliersLookup()
        {
            var result = _supplierService.GetSuppliersLookupAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get phone notes by type for dropdown
        /// Type: 0=Shift presets, other types for different note categories
        /// Query: SELECT * FROM PhoneNote WHERE Type = @type AND Status > -1
        /// </summary>
        /// <param name="type">The phone note type (default: 0 for Shift presets)</param>
        [HttpGet("PhoneNotes")]
        public async Task<IActionResult> GetPhoneNotesByType([FromQuery] short type = 0)
        {
            var result = await _systemLookupService.GetPhoneNotesByTypeAsync(type);
            return Ok(result);
        }

        /// <summary>
        /// Get shift presets for dropdown (shortcut for PhoneNotes?type=0)
        /// Uses PhoneNote table with Type = 0
        /// </summary>
        [HttpGet("ShiftPresets")]
        public async Task<IActionResult> GetShiftPresets()
        {
            var result = await _systemLookupService.GetPhoneNotesByTypeAsync(0);
            return Ok(result);
        }

        /// <summary>
        /// Get distinct zones (CCRT) from CustomerAddresses for dropdown
        /// Query: SELECT DISTINCT CCRT FROM CustomerAddresses WHERE CCRT IS NOT NULL AND CCRT <> ''
        /// </summary>
        [HttpGet("Zones")]
        public async Task<IActionResult> GetZones()
        {
            var result = await _systemLookupService.GetZonesAsync();
            return Ok(result);
        }

        /// <summary>
        /// Get tenders for phone order dropdown
        /// Query: SELECT * FROM Tender WHERE ShowOnPhoneOrder = 1 AND Status > -1
        /// </summary>
        [HttpGet("Tenders")]
        public async Task<IActionResult> GetTenders()
        {
            var result = await _systemLookupService.GetTendersForPhoneOrderAsync();
            return Ok(result);
        }

        /// <summary>
        /// Save phone notes batch (adds new, updates existing, deletes removed)
        /// Used for Shift presets (Type=0), Driver Notes (Type=2), Pick Notes (Type=3)
        /// </summary>
        [HttpPost("PhoneNotes/batch")]
        public async Task<IActionResult> SavePhoneNotesBatch([FromBody] Application.DTOs.Tenant.Lookup.PhoneNoteBatchSaveDto dto)
        {
            var result = await _systemLookupService.SavePhoneNotesBatchAsync(dto);
            return Ok(result);
        }

        /// <summary>
        /// Add a single phone note
        /// </summary>
        [HttpPost("PhoneNotes")]
        public async Task<IActionResult> AddPhoneNote([FromBody] Application.DTOs.Tenant.Lookup.PhoneNoteCreateUpdateDto dto)
        {
            var result = await _systemLookupService.AddPhoneNoteAsync(dto);
            return Ok(result);
        }

        /// <summary>
        /// Update a single phone note
        /// </summary>
        [HttpPut("PhoneNotes/{id}")]
        public async Task<IActionResult> UpdatePhoneNote(int id, [FromBody] Application.DTOs.Tenant.Lookup.PhoneNoteCreateUpdateDto dto)
        {
            var result = await _systemLookupService.UpdatePhoneNoteAsync(id, dto);
            return Ok(result);
        }

        /// <summary>
        /// Delete a single phone note (soft delete)
        /// </summary>
        [HttpDelete("PhoneNotes/{id}")]
        public async Task<IActionResult> DeletePhoneNote(int id)
        {
            var result = await _systemLookupService.DeletePhoneNoteAsync(id);
            return Ok(result);
        }

        /// <summary>
        /// Get users for Pick By dropdown in Phone Order form
        /// Query: SELECT * FROM UsersView WHERE Status > -1 AND (StoreID = @storeId OR IsSuperAdmin = 1 OR IsDefault = 0)
        /// </summary>
        /// <param name="storeId">The store ID to filter users</param>
        [HttpGet("UsersForPickBy")]
        public async Task<IActionResult> GetUsersForPickBy([FromQuery] Guid storeId)
        {
            var result = await _systemLookupService.GetUsersForPickByAsync(storeId);
            return Ok(result);
        }

        /// <summary>
        /// Get all active Mix & Match configurations for dropdown
        /// </summary>
        [HttpGet("MixAndMatches")]
        public async Task<IActionResult> GetMixAndMatches()
        {
            var result = await _systemLookupService.GetMixAndMatchesAsync();
            return Ok(result);
        }

        /// <summary>
        /// Create a new Mix & Match configuration
        /// </summary>
        [HttpPost("MixAndMatches")]
        public async Task<IActionResult> CreateMixAndMatch([FromBody] CreateMixAndMatchDto dto)
        {
            var userId = GetUserIdFromClaims();
            var result = await _systemLookupService.CreateMixAndMatchAsync(dto, userId);
            return Ok(result);
        }

        /// <summary>
        /// Create a new Items Lookup Value (Pattern, Custom Field)
        /// ValueType: 0=Pattern, 1-10=CustomField1-10
        /// </summary>
        [HttpPost("ItemsLookupValues")]
        public async Task<IActionResult> CreateItemsLookupValue([FromBody] CreateItemsLookupValueDto dto)
        {
            var userId = GetUserIdFromClaims();
            var result = await _systemLookupService.CreateItemsLookupValueAsync(dto, userId);
            return Ok(result);
        }

        private Guid GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("LocalUserId")?.Value
                              ?? User.FindFirst("UserId")?.Value
                              ?? User.FindFirst("userId")?.Value
                              ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (Guid.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }
            return Guid.Empty;
        }

        /// <summary>ITEM groups (ItemGroup table) for the discount Import Items "Group"
        /// filter — NOT the employee/security Groups returned by /Groups.</summary>
        [HttpGet("ItemGroups")]
        public async Task<IActionResult> GetItemGroups()
        {
            var result = await _systemLookupService.GetItemGroupsLookupAsync();
            return Ok(result);
        }

        [HttpGet("Groups")]
        public async Task<IActionResult> GetGroups()
        {
            var result = await _systemLookupService.GetGroupsAsync();
            return Ok(result);
        }

        /// <summary>Customer groups for the Filters dialog Customer-tab Group dropdown
        /// (CustomerGroup table). Separate from Groups, which returns security groups.</summary>
        [HttpGet("CustomerGroups")]
        public async Task<IActionResult> GetCustomerGroups()
        {
            var result = await _systemLookupService.GetCustomerGroupsAsync();
            return Ok(result);
        }

        [HttpGet("AllStores")]
        public async Task<IActionResult> GetAllStores()
        {
            var result = await _systemLookupService.GetAllStoresAsync();
            return Ok(result);
        }

        [HttpGet("AdjustTypes")]
        public async Task<IActionResult> GetAdjustTypes()
        {
            var result = await _systemLookupService.GetAdjustTypesAsync();
            return Ok(result);
        }

        // ─── Advanced Filters modal lookups ──────────────────────────────────
        // Endpoints power the multi-tab Filters dialog shown on report pages
        // (Item / Supplier / Customer / More tabs in the desktop BackOffice).
        // Each returns a small {id, label} list ready for SearchableSelect.

        /// <summary>Customer Type filter dropdown (static enum + any DB values).</summary>
        [HttpGet("CustomerTypes")]
        public async Task<IActionResult> GetCustomerTypes()
        {
            var result = await _systemLookupService.GetCustomerTypesAsync();
            return Ok(result);
        }

        /// <summary>Distinct PriceLevelID values customers reference.</summary>
        [HttpGet("PriceLevels")]
        public async Task<IActionResult> GetPriceLevels()
        {
            var result = await _systemLookupService.GetPriceLevelsAsync();
            return Ok(result);
        }

        /// <summary>Distinct customer zip codes (up to 500) for the Customer tab.</summary>
        [HttpGet("CustomerZips")]
        public async Task<IActionResult> GetCustomerZips()
        {
            var result = await _systemLookupService.GetCustomerZipsAsync();
            return Ok(result);
        }

        /// <summary>Discount lookup list for the Customer tab Discount dropdown.</summary>
        [HttpGet("Discounts")]
        public async Task<IActionResult> GetDiscountsLookup()
        {
            var result = await _systemLookupService.GetDiscountsLookupAsync();
            return Ok(result);
        }

        /// <summary>Distinct brand names (up to 1000) for the Item tab Brand dropdown.</summary>
        [HttpGet("Brands")]
        public async Task<IActionResult> GetBrands()
        {
            var result = await _systemLookupService.GetBrandsAsync();
            return Ok(result);
        }

        /// <summary>
        /// Item search for the Item tab autocomplete. Accepts an optional
        /// `search` query and `take` cap (default 50, max 200). Matches name,
        /// barcode, and model number; active items only.
        /// </summary>
        [HttpGet("Items")]
        public async Task<IActionResult> SearchItems([FromQuery] string? search = null, [FromQuery] int take = 50)
        {
            var result = await _systemLookupService.SearchItemsAsync(search, take);
            return Ok(result);
        }

        /// <summary>Distinct active items, paginated + searched — for the discount item picker
        /// (one row per item, so no per-store duplicates to dedupe).</summary>
        [HttpGet("ItemsPaged")]
        public async Task<IActionResult> GetItemsPaged([FromQuery] string? search = null, [FromQuery] int startRow = 0, [FromQuery] int endRow = 20)
        {
            var result = await _systemLookupService.SearchItemsPagedAsync(search, startRow, endRow);
            return Ok(result);
        }

        /// <summary>Resolves a set of item ids to {id, name, …} so the discount picker can
        /// pin already-selected items at the top of the list. POST because a selection can
        /// hold hundreds of ids — too many for a query string.</summary>
        [HttpPost("ItemsByIds")]
        public async Task<IActionResult> GetItemsByIds([FromBody] List<Guid> ids)
        {
            var result = await _systemLookupService.GetItemsByIdsAsync(ids ?? new List<Guid>());
            return Ok(result);
        }

        /// <summary>Items matching the discount "Import Items" filters
        /// (Department / Brand / Supplier / Group / Item Type) — desktop ImportItem parity.</summary>
        [HttpPost("DiscountImportItems")]
        public async Task<IActionResult> GetDiscountImportItems([FromBody] DiscountImportItemsRequestDto request)
        {
            var result = await _systemLookupService.GetDiscountImportItemsAsync(request ?? new DiscountImportItemsRequestDto());
            return Ok(result);
        }
    }
}
