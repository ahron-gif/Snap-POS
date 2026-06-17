using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Item Daily Sales report: aggregated sales per item and day.
    /// </summary>
    public class ItemDailySalesRowDto
    {
        public DateTime SaleDate { get; set; }
        public string ItemName { get; set; } = string.Empty;
        public string? BarcodeNumber { get; set; }
        public string? Department { get; set; }
        public Guid? DepartmentID { get; set; }
        /// <summary>
        /// Master ItemID surfaced by the SP as `ItemNo`. Nullable because manual / orphan
        /// rows (e.g. [MANUAL ITEM]) have no associated catalog item. Used by pivot drill-downs
        /// to look up the underlying transactions for an item in a given date window.
        /// </summary>
        public Guid? ItemID { get; set; }
        public decimal Qty { get; set; }
        public decimal Total { get; set; }
        public decimal AveragePrice { get; set; }
    }

    /// <summary>
    /// Request for Item Daily Sales report.
    /// </summary>
    public class ItemDailySalesRequestDto : PaginationGridDto
    {
        /// <summary>
        /// Inclusive from-date (yyyy-MM-dd). Defaults to today-30.
        /// </summary>
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        /// <summary>
        /// Inclusive to-date (yyyy-MM-dd). Defaults to today.
        /// </summary>
        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        /// <summary>
        /// Optional department filter.
        /// </summary>
        [JsonProperty("departmentId")]
        public Guid? DepartmentId { get; set; }
    }

    /// <summary>
    /// Response for Item Daily Sales report.
    /// </summary>
    public class ItemDailySalesResponseDto
    {
        public List<ItemDailySalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalQty { get; set; }
        public decimal TotalAmount { get; set; }
    }

    // -----------------------------------------------------------------------------------------
    // Pivot view — mirrors the desktop RepItemsDailySales DevExpress PivotGrid:
    //   Row fields:   Department > ItemName > BarcodeNumber
    //   Column field: SaleDate
    //   Data fields:  Amount, Qty
    // The frontend renders this with Department/ItemName/Barcode as sticky-left columns and one
    // pair of (Amount, Qty) columns per date scrolling on the right.
    // -----------------------------------------------------------------------------------------

    /// <summary>
    /// Request for the pivoted Item Daily Sales view. Date range and (optional) store/department
    /// filters mirror the desktop's ReportBar inputs.
    /// </summary>
    public class ItemDailySalesPivotRequestDto
    {
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }

        [JsonProperty("departmentId")]
        public Guid? DepartmentId { get; set; }
    }

    /// <summary>One Amount + Qty cell for a single (item, date) crossing.</summary>
    public class ItemDailySalesPivotCellDto
    {
        public decimal Qty { get; set; }
        public decimal Amount { get; set; }
    }

    /// <summary>One row in the pivot grid (a unique item, with its sparse per-date cells).</summary>
    public class ItemDailySalesPivotRowDto
    {
        /// <summary>ItemID from the SP; null for manual items.</summary>
        public Guid? ItemId { get; set; }

        /// <summary>DepartmentID from the SP; null for items with no department.</summary>
        public Guid? DepartmentId { get; set; }

        public string Department { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public string? Barcode { get; set; }

        /// <summary>
        /// Sparse map keyed by yyyy-MM-dd. Only dates with sales are present — frontend
        /// renders missing dates as "—".
        /// </summary>
        public Dictionary<string, ItemDailySalesPivotCellDto> Cells { get; set; } = new();
    }

    /// <summary>Per-date and grand-total summaries pinned at the bottom of the pivot grid.</summary>
    public class ItemDailySalesPivotTotalsDto
    {
        /// <summary>Per-date totals keyed by yyyy-MM-dd.</summary>
        public Dictionary<string, ItemDailySalesPivotCellDto> ByDate { get; set; } = new();
        public ItemDailySalesPivotCellDto Grand { get; set; } = new();
    }

    /// <summary>Response for the pivoted Item Daily Sales view.</summary>
    public class ItemDailySalesPivotResponseDto
    {
        /// <summary>Ordered list of yyyy-MM-dd column dates (only dates that actually have rows).</summary>
        public List<string> Dates { get; set; } = new();
        public List<ItemDailySalesPivotRowDto> Rows { get; set; } = new();
        public ItemDailySalesPivotTotalsDto Totals { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}

