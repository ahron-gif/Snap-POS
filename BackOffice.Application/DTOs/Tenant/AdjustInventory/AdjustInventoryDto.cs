using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.AdjustInventory
{
    /// <summary>
    /// DTO representing a single item row in the Adjust Inventory grid.
    /// Maps from SP_GetItemsForAdjustResult stored procedure output.
    /// </summary>
    public class AdjustInventoryItemDto
    {
        public Guid ItemID { get; set; }
        public string? CustomerCode { get; set; }
        public Guid ItemStoreID { get; set; }
        public decimal? Price { get; set; }
        public decimal? Cost { get; set; }
        public string? Name { get; set; }
        public string? BarcodeNumber { get; set; }
        public string? ModalNumber { get; set; }
        public decimal? CurrentOnHand { get; set; }
        public decimal? OnHand { get; set; }
        public DateTime? CountDate { get; set; }
        public int? LastCount { get; set; }
        public string? Department { get; set; }
    }

    /// <summary>
    /// Request parameters for loading items into the Adjust Inventory grid.
    /// </summary>
    public class GetItemsForAdjustRequestDto
    {
        public bool CountedOnly { get; set; } = false;
        public bool DiscrepancyOnly { get; set; } = false;
        public Guid? StoreId { get; set; }
        public bool ClearCount { get; set; } = false;
        public bool ReverseQty { get; set; } = false;
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 100;
        public string? SearchText { get; set; }
    }

    /// <summary>
    /// Paginated response for the Adjust Inventory grid.
    /// </summary>
    public class GetItemsForAdjustResponseDto
    {
        public List<AdjustInventoryItemDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    /// <summary>
    /// A single inventory adjustment row to be saved.
    /// </summary>
    public class SaveAdjustmentDto
    {
        public Guid ItemStoreNo { get; set; }
        public decimal Qty { get; set; }
        public decimal OldQty { get; set; }
        public int AdjustType { get; set; }
        public string? AdjustReason { get; set; }
        public int AccountNo { get; set; }
        public decimal Cost { get; set; }
    }

    /// <summary>
    /// Request to save a batch of inventory adjustments.
    /// </summary>
    public class SaveAdjustmentsRequestDto
    {
        public List<SaveAdjustmentDto> Adjustments { get; set; } = new();
        public bool UpdateOnHand { get; set; } = true;
    }

    /// <summary>
    /// Request parameters for the Quick Report.
    /// </summary>
    public class QuickReportRequestDto
    {
        public Guid ItemStoreID { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public Guid? ItemID { get; set; }
    }

    /// <summary>
    /// A single row in the Quick Report grid.
    /// Maps from SP_GetQuickReportResult stored procedure output.
    /// </summary>
    public class QuickReportItemDto
    {
        public Guid? ID { get; set; }
        public string? StoreName { get; set; }
        public string? User { get; set; }
        public string Type { get; set; } = string.Empty;
        public DateTime? Date { get; set; }
        public decimal? Qty { get; set; }
        public decimal? CsQty { get; set; }
        public string? UOM { get; set; }
        /// <summary>
        /// Running on-hand balance after this movement, in chronological order:
        /// OpeningOnHand + cumulative Qty up to and including this row. The last
        /// (newest) row's value equals ClosingOnHand.
        /// </summary>
        public decimal? RunningBalance { get; set; }
    }

    /// <summary>
    /// Response for the Quick Report.
    /// </summary>
    public class QuickReportResponseDto
    {
        public List<QuickReportItemDto> Items { get; set; } = new();

        /// <summary>On-hand balance AS OF the start date — where the running count starts.</summary>
        public decimal OpeningOnHand { get; set; }

        /// <summary>On-hand balance AS OF the end date = OpeningOnHand + sum of all Qty in range.</summary>
        public decimal ClosingOnHand { get; set; }

        /// <summary>Net change over the range (sum of Qty).</summary>
        public decimal Total { get; set; }

        /// <summary>Back-compat alias for the opening balance (older clients).</summary>
        public decimal OnHand { get; set; }
    }

    /// <summary>
    /// A single row in the Inventory By Store grid.
    /// Shows inventory levels for a specific item across all stores.
    /// </summary>
    public class InventoryByStoreItemDto
    {
        public string? StoreName { get; set; }
        public decimal? OnHand { get; set; }
        public decimal? OnOrder { get; set; }
        public decimal? OnTransfer { get; set; }
    }

    /// <summary>
    /// Response for the Inventory By Store popup.
    /// </summary>
    public class InventoryByStoreResponseDto
    {
        public List<InventoryByStoreItemDto> Items { get; set; } = new();
    }
}
