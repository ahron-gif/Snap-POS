using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Item;
using BackOffice.Application.DTOs.Tenant.Lookup;
using BackOffice.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IItemService
    {
        ApiResponse<PaginationResponseDTO<ItemMainAndStoreGridDto>> GetAllItemsMainAndStoreGridAsync(PaginationGridDto pagination);

        /// <summary>
        /// Aggregate totals (count, price sum, cost sum, avg pc cost, on-hand value)
        /// across EVERY row that matches the same filter set the grid is using —
        /// not just the rows the user has scrolled into so far. Powers the
        /// summary cards on the Item List page so they stay catalog-wide while
        /// infinite scroll incrementally loads page data.
        /// </summary>
        ApiResponse<ItemsTotalsDto> GetItemsTotalsAsync(PaginationGridDto pagination);

        /// <summary>
        /// Gets items from the quick list view with pagination, filtering, and sorting
        /// </summary>
        ApiResponse<PaginationResponseDTO<ItemQuickListGridDto>> GetAllItemsQuickListAsync(PaginationGridDto pagination);

        /// <summary>
        /// Creates a new item with ItemMain, ItemStore, and related data (suppliers, groups, aliases)
        /// </summary>
        Task<ApiResponse<CreateItemResponseDto>> AddItemAsync(CreateItemDto createItemDto, Guid userId);

        /// <summary>
        /// Gets an item by ItemStoreID
        /// </summary>
        Task<ApiResponse<ItemMainAndStoreGridDto?>> GetItemByIdAsync(Guid itemStoreId);

        /// <summary>
        /// Updates an existing item with all related entities (ItemMain, ItemStore, ItemSupply, ItemToGroup, ItemAlias)
        /// </summary>
        Task<ApiResponse<CreateItemResponseDto>> UpdateItemAsync(CreateItemDto updateItemDto, Guid userId);

        /// <summary>
        /// Checks if a barcode already exists
        /// </summary>
        Task<ApiResponse<bool>> BarcodeExistsAsync(string barcodeNumber, Guid? excludeItemId = null);

        /// <summary>
        /// Checks if a model number (alternate code) already exists
        /// </summary>
        Task<ApiResponse<bool>> ModelNumberExistsAsync(string modalNumber, Guid? excludeItemId = null);

        /// <summary>
        /// Checks if an item name already exists (duplicate check)
        /// </summary>
        Task<ApiResponse<bool>> ItemNameExistsAsync(string name, Guid? excludeItemId = null);

        /// <summary>
        /// Checks if an alias barcode already exists in ItemAlias or ItemMain tables
        /// </summary>
        Task<ApiResponse<bool>> AliasBarcodeExistsAsync(string barcodeNumber, Guid? excludeAliasId = null, Guid? excludeItemId = null);

        /// <summary>
        /// Generates the next sequential code (UPC/Case/Pkg/Model/Style) via SP_GetNewNumber,
        /// mirroring the legacy back-office's AutoCreateUPC / AutoCreateModel loop. Increments
        /// until uniqueness is satisfied against ItemMain barcodes/model numbers.
        /// </summary>
        /// <param name="codeType">One of: upc, case, pkg, model, style (case-insensitive).</param>
        /// <param name="storeId">Optional store scope passed to SP_GetNewNumber.</param>
        Task<ApiResponse<string>> GenerateItemCodeAsync(string codeType, Guid? storeId = null);

        /// <summary>
        /// Gets department defaults (markup, roundup, taxable, food stamp, discountable) for auto-setting item fields
        /// </summary>
        Task<ApiResponse<DepartmentDefaultsDto?>> GetDepartmentDefaultsAsync(Guid departmentStoreId);

        /// <summary>
        /// Updates the image path for an item
        /// </summary>
        /// <param name="itemId">Item ID (ItemMain.ItemID)</param>
        /// <param name="imagePath">S3 path of the image (null to clear)</param>
        /// <param name="imageSlot">Image slot (1, 2, or 3)</param>
        Task<ApiResult<bool>> UpdateItemImageAsync(Guid itemId, string? imagePath, int imageSlot);

        /// <summary>
        /// Gets the image path for an item
        /// </summary>
        /// <param name="itemId">Item ID (ItemMain.ItemID)</param>
        /// <param name="imageSlot">Image slot (1, 2, or 3)</param>
        Task<ApiResult<string?>> GetItemImagePathAsync(Guid itemId, int imageSlot);

        /// <summary>
        /// Gets items with inventory data across all stores (pivoted by store) with pagination.
        /// SuperAdmin sees all stores in the tenant; non-SuperAdmin users see only stores they
        /// are assigned to via the UsersStores table.
        /// </summary>
        /// <param name="request">Request with pagination and filter parameters</param>
        /// <param name="localUserId">Tenant-local user id (LocalUserId claim) for store-assignment lookup. Required when isSuperAdmin is false.</param>
        /// <param name="isSuperAdmin">True when the caller is a SuperAdmin (no tenant scope) - bypasses UsersStores filtering.</param>
        Task<ApiResponse<ItemsWithInventoryReportDto>> GetItemsWithInventoryAsync(
            ItemsWithInventoryRequestDto request,
            Guid? localUserId,
            bool isSuperAdmin);

        /// <summary>
        /// Toggles item status between active (0) and inactive (1)
        /// </summary>
        /// <param name="itemStoreId">The ItemStore ID</param>
        /// <param name="modifierId">The user performing the action</param>
        Task<ApiResponse<bool>> ToggleItemStatusAsync(Guid itemStoreId, Guid modifierId);

        /// <summary>
        /// Bulk activate items (set Status = 1)
        /// </summary>
        Task<ApiResponse<bool>> BulkActivateAsync(List<Guid> itemStoreIds, Guid modifierId);

        /// <summary>
        /// Bulk deactivate items (set Status = 0)
        /// </summary>
        Task<ApiResponse<bool>> BulkDeactivateAsync(List<Guid> itemStoreIds, Guid modifierId);

        /// <summary>
        /// Bulk toggle phone order disable status on ItemMain
        /// </summary>
        Task<ApiResponse<bool>> BulkTogglePhoneOrderAsync(List<Guid> itemStoreIds, Guid modifierId);

        /// <summary>
        /// Bulk enable phone order on ItemMain (clears IsDisableOnPO).
        /// </summary>
        Task<ApiResponse<bool>> BulkEnablePhoneOrderAsync(List<Guid> itemStoreIds, Guid modifierId);

        /// <summary>
        /// Bulk delete items (set Status = -1)
        /// </summary>
        Task<ApiResponse<bool>> BulkDeleteAsync(List<Guid> itemStoreIds, Guid modifierId);

        // ---------------------------------------------------------------
        // Matrix Children — port of legacy FrmMatrix.vb.
        //
        // A "matrix parent" item (ItemType = MatrixParent) has variant
        // child items (ItemType = MatrixChild) joined by ItemMain.LinkNo
        // == ParentItem.ItemID. Each child has its own per-store row in
        // ItemStore, so all reads/writes here are scoped to a single
        // store. Soft-deletes flip Status = 0 on both rows.
        // ---------------------------------------------------------------

        /// <summary>
        /// Returns all matrix children for the given parent in the
        /// given store. Excludes soft-deleted rows (Status &lt;= 0).
        /// </summary>
        Task<ApiResponse<List<MatrixChildDto>>> GetMatrixChildrenAsync(Guid parentItemId, Guid storeId);

        /// <summary>
        /// Patches a single matrix child row — any subset of editable
        /// fields. Writes ItemMain (StyleNo, Barcode, Model, Matrix1/2)
        /// and ItemStore (Cost, Price, SpecialCost) in one transaction.
        /// </summary>
        Task<ApiResponse<MatrixChildDto>> UpdateMatrixChildAsync(Guid itemStoreId, MatrixChildPatchDto patch, Guid userId);

        /// <summary>
        /// Writes the same Cost (+ SpecialCost + EstimatedCost) to
        /// every child's ItemStore row for this parent and store.
        /// Mirrors the desktop "Update Cost" bulk button.
        /// </summary>
        Task<ApiResponse<int>> BulkUpdateMatrixCostAsync(Guid parentItemId, MatrixBulkCostDto dto, Guid userId);

        /// <summary>
        /// Writes a derived Price to every child's ItemStore row.
        /// See <see cref="MatrixBulkPriceDto"/> for the three modes.
        /// Returns the count of children updated.
        /// </summary>
        Task<ApiResponse<int>> BulkUpdateMatrixPriceAsync(Guid parentItemId, MatrixBulkPriceDto dto, Guid userId);

        /// <summary>
        /// Soft-deletes a single matrix child. Both ItemMain and
        /// ItemStore Status flip to 0; VoidReason is stamped on
        /// ItemStore. Mirrors FrmMatrix delete flow.
        /// </summary>
        Task<ApiResponse<bool>> SoftDeleteMatrixChildAsync(Guid itemStoreId, string? reason, Guid userId);

        /// <summary>
        /// Creates a new matrix child under the given parent. Inherits
        /// Name (with " - {color}/{size}" suffix), Department, Tax,
        /// Discount flags, starting Cost/Price from the parent. Auto-
        /// generates Barcode + ModalNumber via SP_GetNewNumber.
        /// </summary>
        Task<ApiResponse<MatrixChildDto>> AddMatrixChildAsync(Guid parentItemId, MatrixChildCreateDto dto, Guid userId);

        // ---------------------------------------------------------------
        // Matrix Phase 2 — template management + bulk generation +
        // on-hand adjust. Templates live in MatrixTable/MatrixColumn/
        // MatrixValue; the desktop enforces exactly two columns named
        // "Color" + "Size" per template, so this API mirrors that
        // shape (no arbitrary axis names).
        // ---------------------------------------------------------------

        /// <summary>List active matrix templates (Color/Size pairs).</summary>
        Task<ApiResponse<List<MatrixTemplateDto>>> GetMatrixTemplatesAsync();

        /// <summary>One template with its colour + size values populated.</summary>
        Task<ApiResponse<MatrixTemplateDto>> GetMatrixTemplateAsync(Guid templateId);

        /// <summary>
        /// Create a new template — inserts MatrixTable plus the two
        /// canonical "Color" + "Size" MatrixColumn rows in a single
        /// transaction.
        /// </summary>
        Task<ApiResponse<MatrixTemplateDto>> CreateMatrixTemplateAsync(MatrixTemplateCreateDto dto, Guid userId);

        Task<ApiResponse<MatrixTemplateDto>> UpdateMatrixTemplateAsync(Guid templateId, MatrixTemplateUpdateDto dto, Guid userId);

        /// <summary>Soft-delete (Status = -1) so existing items keep their MatrixTableNo intact.</summary>
        Task<ApiResponse<bool>> DeleteMatrixTemplateAsync(Guid templateId, Guid userId);

        /// <summary>Add one value to a template's Color or Size axis.</summary>
        Task<ApiResponse<MatrixValueDto>> AddMatrixValueAsync(Guid templateId, MatrixValueCreateDto dto, Guid userId);

        /// <summary>
        /// Delete one value. When <paramref name="cascadeChildren"/> is
        /// true, also soft-deletes any matrix-child ItemMain/ItemStore
        /// rows that reference this value via Matrix1/Matrix2. Mirrors
        /// the desktop's "make inactive all items using this value?" prompt.
        /// </summary>
        Task<ApiResponse<bool>> DeleteMatrixValueAsync(Guid matrixValueId, bool cascadeChildren, Guid userId);

        /// <summary>Global MatrixColors lookup, ordered by SortValue then DisplayValue.</summary>
        Task<ApiResponse<List<MatrixColorDto>>> GetGlobalMatrixColorsAsync();

        /// <summary>
        /// Cross-product generator: creates one MatrixChild per
        /// (colour × size) combo that doesn't already exist as an
        /// active child of <paramref name="parentItemId"/> in the
        /// given store. Skips empty combos and existing combos.
        /// </summary>
        Task<ApiResponse<MatrixGenerateResultDto>> GenerateMatrixChildrenAsync(Guid parentItemId, MatrixChildGenerateDto dto, Guid userId);

        /// <summary>
        /// Batch-adjust OnHand for several matrix children at once.
        /// Updates ItemStore.OnHand and inserts one AdjustInventory
        /// row per changed child (AdjustType = 3 / Other, with the
        /// caller-supplied reason).
        /// </summary>
        Task<ApiResponse<int>> AdjustMatrixChildOnHandAsync(MatrixOnHandAdjustBatchDto dto, Guid userId);
    }
}
