using BackOffice.Application.DTOs.Tenant.AdjustInventory;
using BackOffice.Common;
using System;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IAdjustInventoryService
    {
        /// <summary>
        /// Gets items for the Adjust Inventory grid with pagination and filtering.
        /// Calls SP_GetItemsForAdjust stored procedure.
        /// </summary>
        Task<ApiResponse<GetItemsForAdjustResponseDto>> GetItemsForAdjustAsync(GetItemsForAdjustRequestDto request);

        /// <summary>
        /// Saves a batch of inventory adjustments.
        /// Calls SP_AdjustInventoryInsert for each adjustment, then optionally runs UpdateOnlyOnhand.
        /// </summary>
        Task<ApiResponse<bool>> SaveAdjustmentsAsync(SaveAdjustmentsRequestDto request, Guid userId);

        /// <summary>
        /// Resets all physical counts for a store.
        /// Calls SP_GetItemsForAdjust with clearCount=true.
        /// </summary>
        Task<ApiResponse<bool>> ResetPhysicalCountAsync(Guid storeId);

        /// <summary>
        /// Gets the Quick Report for a specific item, showing all transactions within a date range.
        /// Calls SP_GetQuickReport stored procedure.
        /// </summary>
        Task<ApiResponse<QuickReportResponseDto>> GetQuickReportAsync(QuickReportRequestDto request);

        /// <summary>
        /// Gets inventory levels for a specific item across all stores.
        /// Queries NewItemMainAndStoreGrids by ItemID.
        /// </summary>
        Task<ApiResponse<InventoryByStoreResponseDto>> GetInventoryByStoreAsync(Guid itemId);
    }
}
