using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Lookup;
using BackOffice.Common;
using System;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface ISystemLookupService
    {
        /// <summary>
        /// Get all item types for dropdown
        /// </summary>
        Task<ApiResponse<List<ItemTypeLookupDto>>> GetItemTypesAsync();

        /// <summary>
        /// Get all barcode types for dropdown
        /// </summary>
        Task<ApiResponse<List<BarcodeTypeLookupDto>>> GetBarcodeTypesAsync();

        /// <summary>
        /// Get all UOM types for dropdown
        /// </summary>
        Task<ApiResponse<List<UOMTypeLookupDto>>> GetUOMTypesAsync();

        /// <summary>
        /// Get all measure types for dropdown
        /// </summary>
        Task<ApiResponse<List<MeasureLookupDto>>> GetMeasureTypesAsync();

        /// <summary>
        /// Get all departments for dropdown (hierarchical tree structure)
        /// </summary>
        Task<ApiResponse<List<DepartmentLookupDto>>> GetDepartmentsAsync();

        /// <summary>
        /// Get all items lookup values by type for dropdowns
        /// ValueType: 0=Pattern, 1-10=CustomField1-10, 11=Manufacturer
        /// </summary>
        Task<ApiResponse<List<ItemsLookupValueDto>>> GetItemsLookupValuesAsync(short? valueType = null);

        /// <summary>
        /// Get all extra charge items for dropdown (Extra Charge 1, 2, 3)
        /// Uses SP_GetExtraChargeItems stored procedure
        /// </summary>
        /// <param name="storeId">The store ID to filter items</param>
        Task<ApiResponse<List<ExtraChargeItemLookupDto>>> GetExtraChargeItemsAsync(Guid storeId);

        /// <summary>
        /// Get all stores for dropdown (from SP_GetStoresByUser)
        /// Used to populate Store dropdown in Item form header
        /// </summary>
        /// <param name="userId">The user ID to filter stores</param>
        /// <param name="storeId">Optional current store ID</param>
        Task<ApiResponse<List<StoreLookupDto>>> GetStoresByUserAsync(Guid userId, Guid? storeId = null);

        /// <summary>
        /// Get all app items for App Button dropdown
        /// Uses SP_GetAppItems stored procedure
        /// </summary>
        Task<ApiResponse<List<AppItemLookupDto>>> GetAppItemsAsync();

        /// <summary>
        /// Get all tax rates for dropdown (Tax table: TaxID, TaxName)
        /// </summary>
        Task<ApiResponse<List<TaxLookupDto>>> GetTaxesAsync();

        /// <summary>
        /// Get phone notes by type for dropdown
        /// Used for Shift presets (Type=0), Driver Notes, etc.
        /// Query: SELECT * FROM PhoneNote WHERE Type = @type AND Status > -1
        /// </summary>
        /// <param name="type">The phone note type (0=Shift, etc.)</param>
        Task<ApiResponse<List<PhoneNoteLookupDto>>> GetPhoneNotesByTypeAsync(short type);

        /// <summary>
        /// Get distinct zones (CCRT) from CustomerAddresses for dropdown
        /// Query: SELECT DISTINCT CCRT FROM CustomerAddresses WHERE CCRT IS NOT NULL AND CCRT <> ''
        /// </summary>
        Task<ApiResponse<List<ZoneLookupDto>>> GetZonesAsync();

        /// <summary>
        /// Get tenders for phone order dropdown
        /// Query: SELECT * FROM Tender WHERE ShowOnPhoneOrder = 1 AND Status > -1
        /// </summary>
        Task<ApiResponse<List<TenderLookupDto>>> GetTendersForPhoneOrderAsync();

        /// <summary>
        /// Save phone notes batch (adds new, updates existing, deletes removed)
        /// Used for Shift presets (Type=0), Driver Notes (Type=2), Pick Notes (Type=3)
        /// </summary>
        /// <param name="dto">Batch save DTO containing type and list of notes</param>
        Task<ApiResponse<List<PhoneNoteLookupDto>>> SavePhoneNotesBatchAsync(PhoneNoteBatchSaveDto dto);

        /// <summary>
        /// Add a single phone note
        /// </summary>
        Task<ApiResponse<PhoneNoteLookupDto>> AddPhoneNoteAsync(PhoneNoteCreateUpdateDto dto);

        /// <summary>
        /// Update a single phone note
        /// </summary>
        Task<ApiResponse<PhoneNoteLookupDto>> UpdatePhoneNoteAsync(int id, PhoneNoteCreateUpdateDto dto);

        /// <summary>
        /// Delete a single phone note
        /// </summary>
        Task<ApiResponse<bool>> DeletePhoneNoteAsync(int id);

        /// <summary>
        /// Get users for Pick By dropdown in Phone Order form
        /// Query: SELECT * FROM UsersView WHERE Status > -1 AND (StoreID = @storeId OR IsSuperAdmin = 1 OR IsDefault = 0)
        /// </summary>
        /// <param name="storeId">The store ID to filter users</param>
        Task<ApiResponse<List<UserLookupDto>>> GetUsersForPickByAsync(Guid storeId);

        /// <summary>
        /// Get all active Mix & Match configurations for dropdown
        /// </summary>
        Task<ApiResponse<List<MixAndMatchLookupDto>>> GetMixAndMatchesAsync();

        /// <summary>
        /// Create a new Mix & Match configuration
        /// </summary>
        Task<ApiResponse<MixAndMatchLookupDto>> CreateMixAndMatchAsync(CreateMixAndMatchDto dto, Guid userId);

        Task<ApiResponse<List<GroupLookupDto>>> GetGroupsAsync();

        /// <summary>Customer groups (CustomerGroup table) for the Filters dialog
        /// Customer-tab Group dropdown. Distinct from GetGroupsAsync (security groups).</summary>
        Task<ApiResponse<List<GroupLookupDto>>> GetCustomerGroupsAsync();

        Task<ApiResponse<List<StoreLookupDto>>> GetAllStoresAsync();

        Task<ApiResponse<List<AdjustTypeLookupDto>>> GetAdjustTypesAsync();
        /// <summary>
        /// Create a new Items Lookup Value (Pattern, Custom Field)
        /// </summary>
        Task<ApiResponse<ItemsLookupValueDto>> CreateItemsLookupValueAsync(CreateItemsLookupValueDto dto, Guid userId);

        // ─── Advanced Filters modal lookups ──────────────────────────────
        // Power the multi-tab Filters dialog on report pages. See
        // AdvancedFiltersModal on the frontend.

        Task<ApiResponse<List<CustomerTypeLookupDto>>> GetCustomerTypesAsync();
        Task<ApiResponse<List<PriceLevelLookupDto>>> GetPriceLevelsAsync();
        Task<ApiResponse<List<ZipLookupDto>>> GetCustomerZipsAsync();
        Task<ApiResponse<List<DiscountLookupDto>>> GetDiscountsLookupAsync();
        Task<ApiResponse<List<BrandLookupDto>>> GetBrandsAsync();
        /// <summary>
        /// Search items by name / barcode / model. Returns up to <paramref name="take"/>
        /// matches; pass empty <paramref name="search"/> to get the first N items.
        /// </summary>
        Task<ApiResponse<List<ItemFilterLookupDto>>> SearchItemsAsync(string? search, int take = 50);

        /// <summary>Distinct active items (ItemMain), paginated + searched — discount/report item picker.</summary>
        Task<ApiResponse<PaginationResponseDTO<ItemFilterLookupDto>>> SearchItemsPagedAsync(string? search, int startRow, int endRow);

        /// <summary>
        /// Resolves a set of ItemMain ids to their {id, name, barcode, model} so the
        /// discount item picker can pin already-selected items at the top of the list
        /// even when they're not on a loaded page of the paginated catalog.
        /// </summary>
        Task<ApiResponse<List<ItemFilterLookupDto>>> GetItemsByIdsAsync(IReadOnlyList<Guid> ids);

        /// <summary>
        /// Items matching the discount "Import Items" filters (Department / Brand /
        /// Supplier / Group / Item Type), mirroring the desktop ImportItem Fill query.
        /// </summary>
        Task<ApiResponse<List<DiscountImportItemDto>>> GetDiscountImportItemsAsync(DiscountImportItemsRequestDto request);

        /// <summary>
        /// ITEM groups (the ItemGroup table referenced by ItemToGroup) — for the
        /// discount Import Items "Group" filter. NOT the employee/security Groups table.
        /// </summary>
        Task<ApiResponse<List<GroupLookupDto>>> GetItemGroupsLookupAsync();
    }
}
