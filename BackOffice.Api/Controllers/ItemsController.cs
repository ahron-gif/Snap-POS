using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Item;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BackOffice.Api.Controllers

{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ItemsController : ControllerBase
    {
        private readonly IItemService _itemService;
        private readonly IMapper _mapper;
        private readonly IS3StorageService _s3StorageService;

        public ItemsController(IItemService itemService, IMapper mapper, IS3StorageService s3StorageService)
        {
            _itemService = itemService;
            _mapper = mapper;
            _s3StorageService = s3StorageService;
        }

        /// <summary>
        /// Gets all items with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of items</returns>
        [HttpGet("GetAllItems")]
        public async Task<IActionResult> GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _itemService.GetAllItemsMainAndStoreGridAsync(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Returns aggregate totals (count, price sum, cost sum, avg pc cost,
        /// on-hand value) across EVERY row matching the current filter set —
        /// powers the Item List summary cards so they show catalog totals
        /// instead of "totals of rows loaded so far via infinite scroll".
        /// Accepts the SAME query params as GetAllItems; ignores paging/sort.
        /// </summary>
        [HttpGet("Totals")]
        public async Task<IActionResult> GetTotals([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _itemService.GetItemsTotalsAsync(paginationGridDto);
            return Ok(result);
        }

        /// <summary>
        /// Gets items from the quick list view with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>ZXC 
       /// <param name="paginationGridDto">pagination parameters</param>
        /// <returns>Paginated list of items (lightweight)</returns>
        [HttpGet("GetItemsQuickList")]
        public IActionResult GetItemsQuickList([FromQuery] PaginationGridDto paginationGridDto) 
           
        {
            var result = _itemService.GetAllItemsQuickListAsync(paginationGridDto);
            return Ok(result);
        } 

        /// <summary>
        /// Creates a new item with all related data (ItemMain , ItemStore, suppliers, groups, aliases)
        /// </summary>
        /// <param name="createItemDto">Item data to create</param>
        /// <returns>Created item details</returns>
        [HttpPost("AddItem")] 
        public async Task<IActionResult> AddItem([FromBody] CreateItemDto createItemDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Get LocalUserId (Guid) from claims - this is the tenant-specific user ID
            var localUserIdClaim = User.FindFirst("LocalUserId");
            Guid userId = Guid.Empty;
            if (localUserIdClaim != null && Guid.TryParse(localUserIdClaim.Value, out var parsedUserId))
            {
                userId = parsedUserId;
            }

            var result = await _itemService.AddItemAsync(createItemDto, userId);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Updates an existing item with all related data (ItemMain, ItemStore, suppliers, groups, aliases)
        /// </summary>
        /// <param name="updateItemDto">Item data to update</param>
        /// <returns>Updated item details</returns>
        [HttpPut("UpdateItem")]
        public async Task<IActionResult> UpdateItem([FromBody] CreateItemDto updateItemDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Get LocalUserId (Guid) from claims - this is the tenant-specific user ID
            var localUserIdClaim = User.FindFirst("LocalUserId");
            Guid userId = Guid.Empty;
            if (localUserIdClaim != null && Guid.TryParse(localUserIdClaim.Value, out var parsedUserId))
            {
                userId = parsedUserId;
            }

            var result = await _itemService.UpdateItemAsync(updateItemDto, userId);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets an item by ItemStoreID
        /// </summary>
        /// <param name="itemStoreId">The ItemStore ID</param>
        /// <returns>Item details</returns>
        [HttpGet("GetItem/{itemStoreId}")]
        public async Task<IActionResult> GetItem(Guid itemStoreId)
        {
            var result = await _itemService.GetItemByIdAsync(itemStoreId);

            if (!result.IsSuccess)
            {
                return NotFound(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Checks if a barcode already exists in the system
        /// </summary>
        /// <param name="barcodeNumber">Barcode to check</param>
        /// <param name="excludeItemId">Optional: Item ID to exclude from check (for updates)</param>
        /// <returns>Boolean indicating if barcode exists</returns>
        [HttpGet("BarcodeExists")]
        public async Task<IActionResult> BarcodeExists([FromQuery] string barcodeNumber, [FromQuery] Guid? excludeItemId = null)
        {
            if (string.IsNullOrWhiteSpace(barcodeNumber))
            {
                return BadRequest("Barcode number is required.");
            }

            var result = await _itemService.BarcodeExistsAsync(barcodeNumber, excludeItemId);
            return Ok(result);
        }

        /// <summary>
        /// Checks if a model number (alternate code) already exists in the system
        /// </summary>
        /// <param name="modalNumber">Model number to check</param>
        /// <param name="excludeItemId">Optional: Item ID to exclude from check (for updates)</param>
        /// <returns>Boolean indicating if model number exists</returns>
        [HttpGet("ModelNumberExists")]
        public async Task<IActionResult> ModelNumberExists([FromQuery] string modalNumber, [FromQuery] Guid? excludeItemId = null)
        {
            if (string.IsNullOrWhiteSpace(modalNumber))
            {
                return BadRequest("Model number is required.");
            }

            var result = await _itemService.ModelNumberExistsAsync(modalNumber, excludeItemId);
            return Ok(result);
        }

        /// <summary>
        /// Checks if an item name already exists in the system
        /// </summary>
        /// <param name="name">Item name to check</param>
        /// <param name="excludeItemId">Optional: Item ID to exclude from check (for updates)</param>
        /// <returns>Boolean indicating if name exists</returns>
        [HttpGet("ItemNameExists")]
        public async Task<IActionResult> ItemNameExists([FromQuery] string name, [FromQuery] Guid? excludeItemId = null)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return BadRequest("Item name is required.");
            }

            var result = await _itemService.ItemNameExistsAsync(name, excludeItemId);
            return Ok(result);
        }

        /// <summary>
        /// Checks if an alias barcode already exists in ItemAlias or ItemMain tables
        /// </summary>
        /// <param name="barcodeNumber">Barcode to check</param>
        /// <param name="excludeAliasId">Optional: Alias ID to exclude from check (for updates)</param>
        /// <returns>Boolean indicating if barcode exists</returns>
        [HttpGet("AliasBarcodeExists")]
        public async Task<IActionResult> AliasBarcodeExists([FromQuery] string barcodeNumber, [FromQuery] Guid? excludeAliasId = null, [FromQuery] Guid? excludeItemId = null)
        {
            if (string.IsNullOrWhiteSpace(barcodeNumber))
            {
                return BadRequest("Barcode number is required.");
            }

            var result = await _itemService.AliasBarcodeExistsAsync(barcodeNumber, excludeAliasId, excludeItemId);
            return Ok(result);
        }

        /// <summary>
        /// Generates the next sequential code (UPC / Case / Pkg / Model / Style) via SP_GetNewNumber,
        /// mirroring the legacy back-office AutoCreateUPC / AutoCreateModel logic.
        /// </summary>
        /// <param name="codeType">One of: upc, case, pkg, model, style (case-insensitive).</param>
        /// <param name="storeId">Optional store scope passed to SP_GetNewNumber.</param>
        [HttpGet("GenerateCode")]
        public async Task<IActionResult> GenerateCode([FromQuery] string codeType, [FromQuery] Guid? storeId = null)
        {
            if (string.IsNullOrWhiteSpace(codeType))
            {
                return BadRequest("codeType is required.");
            }

            var result = await _itemService.GenerateItemCodeAsync(codeType, storeId);
            return Ok(result);
        }

        /// <summary>
        /// Gets department defaults (markup, roundup, taxable, food stamp, discountable) for auto-setting item fields
        /// </summary>
        /// <param name="departmentStoreId">Department Store ID</param>
        /// <returns>Department defaults</returns>
        [HttpGet("DepartmentDefaults/{departmentStoreId}")]
        public async Task<IActionResult> GetDepartmentDefaults(Guid departmentStoreId)
        {
            var result = await _itemService.GetDepartmentDefaultsAsync(departmentStoreId);

            if (!result.IsSuccess)
            {
                return NotFound(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Uploads an image for an item to S3 cloud storage
        /// </summary>
        /// <param name="file">Image file to upload</param>
        /// <param name="itemId">Optional: Item ID to associate with (for existing items)</param>
        /// <param name="imageSlot">Image slot (1, 2, or 3) - defaults to 1</param>
        /// <returns>Upload result with image URL</returns>
        [HttpPost("UploadImage")]
        public async Task<IActionResult> UploadImage(IFormFile file, [FromQuery] Guid? itemId = null, [FromQuery] int imageSlot = 1)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new ApiResult<object> { IsSuccess = false, Message = "No file uploaded." });
            }

            // Validate file type
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
            {
                return BadRequest(new ApiResult<object> { IsSuccess = false, Message = "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed." });
            }

            // Validate file size (max 5MB)
            if (file.Length > 5 * 1024 * 1024)
            {
                return BadRequest(new ApiResult<object> { IsSuccess = false, Message = "File size exceeds 5MB limit." });
            }

            // Validate image slot
            if (imageSlot < 1 || imageSlot > 3)
            {
                return BadRequest(new ApiResult<object> { IsSuccess = false, Message = "Image slot must be 1, 2, or 3." });
            }

            try
            {
                // Generate unique filename
                var extension = Path.GetExtension(file.FileName);
                var fileName = $"{Guid.NewGuid()}{extension}";

                // Upload to S3
                using var stream = file.OpenReadStream();
                var s3Path = await _s3StorageService.UploadFileAsync(stream, fileName, file.ContentType);
                // Use pre-signed URL for private S3 buckets (expires in 60 minutes)
                var imageUrl = _s3StorageService.GetPreSignedUrl(fileName, 60);

                // If itemId is provided, update the item with the image path
                if (itemId.HasValue && itemId.Value != Guid.Empty)
                {
                    var updateResult = await _itemService.UpdateItemImageAsync(itemId.Value, s3Path, imageSlot);
                    if (!updateResult.IsSuccess)
                    {
                        // Image uploaded but couldn't update item - still return success with URL
                        return Ok(new ApiResult<object>
                        {
                            IsSuccess = true,
                            Message = "Image uploaded but could not link to item.",
                            Response = new { imageUrl, s3Path, fileName }
                        });
                    }
                }

                return Ok(new ApiResult<object>
                {
                    IsSuccess = true,
                    Message = "Image uploaded successfully.",
                    Response = new { imageUrl, s3Path, fileName }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResult<object>
                {
                    IsSuccess = false,
                    Message = $"Error uploading image: {ex.Message}"
                });
            }
        }

        /// <summary>
        /// Gets the image URL for an item
        /// </summary>
        /// <param name="itemId">Item ID</param>
        /// <param name="imageSlot">Image slot (1, 2, or 3)</param>
        /// <returns>Image URL</returns>
        [HttpGet("GetImageUrl/{itemId}")]
        public async Task<IActionResult> GetImageUrl(Guid itemId, [FromQuery] int imageSlot = 1)
        {
            if (imageSlot < 1 || imageSlot > 3)
            {
                return BadRequest(new ApiResult<object> { IsSuccess = false, Message = "Image slot must be 1, 2, or 3." });
            }

            var result = await _itemService.GetItemImagePathAsync(itemId, imageSlot);
            if (!result.IsSuccess || string.IsNullOrEmpty(result.Response))
            {
                return NotFound(new ApiResult<object> { IsSuccess = false, Message = "Image not found." });
            }

            // Use pre-signed URL for private S3 buckets (expires in 60 minutes)
            var imageUrl = _s3StorageService.GetPreSignedUrl(result.Response, 60);
            return Ok(new ApiResult<object>
            {
                IsSuccess = true,
                Response = new { imageUrl, s3Path = result.Response }
            });
        }

        /// <summary>
        /// Deletes an image for an item
        /// </summary>
        /// <param name="itemId">Item ID</param>
        /// <param name="imageSlot">Image slot (1, 2, or 3)</param>
        /// <returns>Delete result</returns>
        [HttpDelete("DeleteImage/{itemId}")]
        public async Task<IActionResult> DeleteImage(Guid itemId, [FromQuery] int imageSlot = 1)
        {
            if (imageSlot < 1 || imageSlot > 3)
            {
                return BadRequest(new ApiResult<object> { IsSuccess = false, Message = "Image slot must be 1, 2, or 3." });
            }

            // Get current image path
            var pathResult = await _itemService.GetItemImagePathAsync(itemId, imageSlot);
            if (!pathResult.IsSuccess || string.IsNullOrEmpty(pathResult.Response))
            {
                return NotFound(new ApiResult<object> { IsSuccess = false, Message = "Image not found." });
            }

            // Delete from S3
            var deleted = await _s3StorageService.DeleteFileAsync(pathResult.Response);
            if (!deleted)
            {
                return StatusCode(500, new ApiResult<object> { IsSuccess = false, Message = "Failed to delete image from storage." });
            }

            // Clear image path in database
            var updateResult = await _itemService.UpdateItemImageAsync(itemId, null, imageSlot);
            if (!updateResult.IsSuccess)
            {
                return StatusCode(500, new ApiResult<object> { IsSuccess = false, Message = "Failed to update item record." });
            }

            return Ok(new ApiResult<object> { IsSuccess = true, Message = "Image deleted successfully." });
        }

        /// <summary>
        /// Gets items with inventory data across all stores (pivoted by store) with pagination
        /// Used for the Items With Inventory report showing inventory across multiple stores
        /// </summary>
        /// <param name="storeId">Optional: Store ID to filter base items</param>
        /// <param name="pageNumber">Page number (default: 1)</param>
        /// <param name="pageSize">Page size (default: 100)</param>
        /// <param name="searchText">Optional: Search text to filter items</param>
        /// <returns>Items with inventory data pivoted by store</returns>
        [HttpGet("GetItemsWithInventory")]
        public async Task<IActionResult> GetItemsWithInventory(
            [FromQuery] Guid? storeId = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 100,
            [FromQuery] string? searchText = null)
        {
            var request = new ItemsWithInventoryRequestDto
            {
                StoreId = storeId,
                PageNumber = pageNumber,
                PageSize = pageSize,
                SearchText = searchText
            };

            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            var isSuperAdmin = string.IsNullOrEmpty(customerIdClaim) || customerIdClaim == "0";

            Guid? localUserId = null;
            var localUserIdClaim = User.FindFirst("LocalUserId")?.Value;
            if (!string.IsNullOrEmpty(localUserIdClaim) && Guid.TryParse(localUserIdClaim, out var parsedUserId))
            {
                localUserId = parsedUserId;
            }

            var result = await _itemService.GetItemsWithInventoryAsync(request, localUserId, isSuperAdmin);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Toggle item status between active (0) and inactive (1)
        /// </summary>
        /// <param name="itemStoreId">The ItemStore ID</param>
        /// <returns>Success result with new status message</returns>
        [HttpPut("{itemStoreId}/toggle-status")]
        public async Task<IActionResult> ToggleItemStatus(Guid itemStoreId)
        {
            var localUserIdClaim = User.FindFirst("LocalUserId");
            Guid modifierId = Guid.Empty;
            if (localUserIdClaim != null && Guid.TryParse(localUserIdClaim.Value, out var parsedUserId))
            {
                modifierId = parsedUserId;
            }

            var result = await _itemService.ToggleItemStatusAsync(itemStoreId, modifierId);
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        /// <summary>
        /// Bulk activate items (set Status = 1)
        /// </summary>
        [HttpPut("bulk-activate")]
        public async Task<IActionResult> BulkActivate([FromBody] BulkItemActionDto dto)
        {
            var modifierId = GetModifierId();
            var result = await _itemService.BulkActivateAsync(dto.ItemStoreIds, modifierId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Bulk deactivate items (set Status = 0)
        /// </summary>
        [HttpPut("bulk-deactivate")]
        public async Task<IActionResult> BulkDeactivate([FromBody] BulkItemActionDto dto)
        {
            var modifierId = GetModifierId();
            var result = await _itemService.BulkDeactivateAsync(dto.ItemStoreIds, modifierId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Bulk toggle phone order disable status
        /// </summary>
        [HttpPut("bulk-toggle-phone-order")]
        public async Task<IActionResult> BulkTogglePhoneOrder([FromBody] BulkItemActionDto dto)
        {
            var modifierId = GetModifierId();
            var result = await _itemService.BulkTogglePhoneOrderAsync(dto.ItemStoreIds, modifierId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Bulk enable phone order (clear IsDisableOnPO).
        /// </summary>
        [HttpPut("bulk-enable-phone-order")]
        public async Task<IActionResult> BulkEnablePhoneOrder([FromBody] BulkItemActionDto dto)
        {
            var modifierId = GetModifierId();
            var result = await _itemService.BulkEnablePhoneOrderAsync(dto.ItemStoreIds, modifierId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Bulk delete items (set Status = -1)
        /// </summary>
        [HttpPut("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] BulkItemActionDto dto)
        {
            var modifierId = GetModifierId();
            var result = await _itemService.BulkDeleteAsync(dto.ItemStoreIds, modifierId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        private Guid GetModifierId()
        {
            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim != null && Guid.TryParse(localUserIdClaim.Value, out var parsedUserId))
                return parsedUserId;
            return Guid.Empty;
        }

        // ---------------------------------------------------------------
        // Matrix Children — port of legacy FrmMatrix.vb tab.
        //
        // Routes:
        //   GET    api/Items/{parentId}/matrix-children?storeId=...
        //   PATCH  api/Items/matrix-children/{itemStoreId}
        //   POST   api/Items/{parentId}/matrix-children
        //   POST   api/Items/{parentId}/matrix-children/bulk-cost
        //   POST   api/Items/{parentId}/matrix-children/bulk-price
        //   DELETE api/Items/matrix-children/{itemStoreId}
        //
        // All write endpoints stamp DateModified / UserModified from
        // the LocalUserId claim via the existing GetModifierId helper.
        // ---------------------------------------------------------------

        /// <summary>
        /// Returns the matrix children of <paramref name="parentId"/> in
        /// the given store. Soft-deleted rows are filtered out. Used
        /// to populate the Matrix tab grid on the Item form.
        /// </summary>
        [HttpGet("{parentId:guid}/matrix-children")]
        public async Task<IActionResult> GetMatrixChildren(Guid parentId, [FromQuery] Guid storeId)
        {
            var result = await _itemService.GetMatrixChildrenAsync(parentId, storeId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Patches a single matrix-child row. Body fields are nullable;
        /// only non-null fields are applied. Returns the refreshed row.
        /// </summary>
        [HttpPatch("matrix-children/{itemStoreId:guid}")]
        public async Task<IActionResult> PatchMatrixChild(Guid itemStoreId, [FromBody] MatrixChildPatchDto patch)
        {
            if (patch == null) return BadRequest("Patch body is required.");
            var result = await _itemService.UpdateMatrixChildAsync(itemStoreId, patch, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Bulk-writes Cost / SpecialCost / EstimatedCost across every
        /// active matrix child of this parent in the given store.
        /// Mirrors the desktop "Update Cost" header button.
        /// </summary>
        [HttpPost("{parentId:guid}/matrix-children/bulk-cost")]
        public async Task<IActionResult> BulkCostMatrixChildren(Guid parentId, [FromBody] MatrixBulkCostDto dto)
        {
            if (dto == null) return BadRequest("Body is required.");
            var result = await _itemService.BulkUpdateMatrixCostAsync(parentId, dto, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Bulk-writes Price across every active matrix child. Body
        /// chooses absolute / margin / markup mode. Mirrors the
        /// desktop "Update Price" header button.
        /// </summary>
        [HttpPost("{parentId:guid}/matrix-children/bulk-price")]
        public async Task<IActionResult> BulkPriceMatrixChildren(Guid parentId, [FromBody] MatrixBulkPriceDto dto)
        {
            if (dto == null) return BadRequest("Body is required.");
            var result = await _itemService.BulkUpdateMatrixPriceAsync(parentId, dto, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Soft-deletes one matrix child (Status = 0 on both ItemMain
        /// and ItemStore, plus a VoidReason on the store row).
        /// </summary>
        [HttpDelete("matrix-children/{itemStoreId:guid}")]
        public async Task<IActionResult> DeleteMatrixChild(Guid itemStoreId, [FromQuery] string? reason)
        {
            var result = await _itemService.SoftDeleteMatrixChildAsync(itemStoreId, reason, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Adds a new matrix child under <paramref name="parentId"/> in
        /// the given store. Inherits attributes from the parent and
        /// auto-generates Barcode + Model number.
        /// </summary>
        [HttpPost("{parentId:guid}/matrix-children")]
        public async Task<IActionResult> AddMatrixChild(Guid parentId, [FromBody] MatrixChildCreateDto dto)
        {
            if (dto == null) return BadRequest("Body is required.");
            var result = await _itemService.AddMatrixChildAsync(parentId, dto, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        // ---------------------------------------------------------------
        // Matrix Phase 2 — template + value management, bulk
        // generation, on-hand adjust. See IItemService for behaviour.
        // ---------------------------------------------------------------

        [HttpGet("matrix-templates")]
        public async Task<IActionResult> GetMatrixTemplates()
        {
            var result = await _itemService.GetMatrixTemplatesAsync();
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("matrix-templates/{templateId:guid}")]
        public async Task<IActionResult> GetMatrixTemplate(Guid templateId)
        {
            var result = await _itemService.GetMatrixTemplateAsync(templateId);
            return result.IsSuccess ? Ok(result) : NotFound(result);
        }

        [HttpPost("matrix-templates")]
        public async Task<IActionResult> CreateMatrixTemplate([FromBody] MatrixTemplateCreateDto dto)
        {
            if (dto == null) return BadRequest("Body is required.");
            var result = await _itemService.CreateMatrixTemplateAsync(dto, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpPut("matrix-templates/{templateId:guid}")]
        public async Task<IActionResult> UpdateMatrixTemplate(Guid templateId, [FromBody] MatrixTemplateUpdateDto dto)
        {
            if (dto == null) return BadRequest("Body is required.");
            var result = await _itemService.UpdateMatrixTemplateAsync(templateId, dto, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpDelete("matrix-templates/{templateId:guid}")]
        public async Task<IActionResult> DeleteMatrixTemplate(Guid templateId)
        {
            var result = await _itemService.DeleteMatrixTemplateAsync(templateId, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>Add one value (Color or Size axis) to a template.</summary>
        [HttpPost("matrix-templates/{templateId:guid}/values")]
        public async Task<IActionResult> AddMatrixValue(Guid templateId, [FromBody] MatrixValueCreateDto dto)
        {
            if (dto == null) return BadRequest("Body is required.");
            var result = await _itemService.AddMatrixValueAsync(templateId, dto, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Delete one value. cascadeChildren=true also soft-deletes
        /// any child items using that value (mirrors desktop's prompt).
        /// </summary>
        [HttpDelete("matrix-values/{matrixValueId:guid}")]
        public async Task<IActionResult> DeleteMatrixValue(Guid matrixValueId, [FromQuery] bool cascadeChildren = false)
        {
            var result = await _itemService.DeleteMatrixValueAsync(matrixValueId, cascadeChildren, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>Global MatrixColors lookup for the picker.</summary>
        [HttpGet("matrix-colors")]
        public async Task<IActionResult> GetGlobalMatrixColors()
        {
            var result = await _itemService.GetGlobalMatrixColorsAsync();
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Bulk-generate matrix children from picked colour × size
        /// values. Skips combos that already exist as active children.
        /// </summary>
        [HttpPost("{parentId:guid}/matrix-children/generate")]
        public async Task<IActionResult> GenerateMatrixChildren(Guid parentId, [FromBody] MatrixChildGenerateDto dto)
        {
            if (dto == null) return BadRequest("Body is required.");
            var result = await _itemService.GenerateMatrixChildrenAsync(parentId, dto, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Batch on-hand adjust — writes ItemStore.OnHand and inserts
        /// one AdjustInventory row per changed child.
        /// </summary>
        [HttpPost("matrix-children/adjust-onhand")]
        public async Task<IActionResult> AdjustMatrixChildOnHand([FromBody] MatrixOnHandAdjustBatchDto dto)
        {
            if (dto == null) return BadRequest("Body is required.");
            var result = await _itemService.AdjustMatrixChildOnHandAsync(dto, GetModifierId());
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }

    public class BulkItemActionDto
    {
        public List<Guid> ItemStoreIds { get; set; } = new();
    }
}
