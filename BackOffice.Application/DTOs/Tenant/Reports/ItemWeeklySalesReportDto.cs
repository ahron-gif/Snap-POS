using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Item Weekly Sales report: aggregated sales per item and week.
    /// </summary>
    public class ItemWeeklySalesRowDto
    {
        /// <summary>
        /// Start date of the week bucket (e.g. Monday) in local store time.
        /// </summary>
        public DateTime WeekStartDate { get; set; }

        public string ItemName { get; set; } = string.Empty;
        public string? BarcodeNumber { get; set; }
        public string? Department { get; set; }
        public Guid? DepartmentID { get; set; }
        public decimal Qty { get; set; }
        public decimal Total { get; set; }
        public decimal AveragePrice { get; set; }
    }

    /// <summary>
    /// Request for Item Weekly Sales report.
    /// </summary>
    public class ItemWeeklySalesRequestDto : PaginationGridDto
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
    /// Response for Item Weekly Sales report.
    /// </summary>
    public class ItemWeeklySalesResponseDto
    {
        public List<ItemWeeklySalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalQty { get; set; }
        public decimal TotalAmount { get; set; }
    }

    // -----------------------------------------------------------------------------------------
    // Pivot view — mirrors the desktop RepItemsWeeklySales DevExpress PivotGrid:
    //   Row fields:   Department > ItemName > Barcode
    //   Column field: WeekNumber (first day of week, by SetupValues OptionID 131)
    //   Data fields:  Amount, Qty
    // Same response shape as the daily pivot — only the column keys differ (week-start date
    // instead of single day). The frontend renders the header as "M/D - M/D" (week range).
    // -----------------------------------------------------------------------------------------

    public class ItemWeeklySalesPivotRequestDto
    {
        [JsonProperty("fromDate")] public string? FromDate { get; set; }
        [JsonProperty("toDate")]   public string? ToDate   { get; set; }
        [JsonProperty("storeId")]  public Guid?   StoreId  { get; set; }
        [JsonProperty("departmentId")] public Guid? DepartmentId { get; set; }
    }

    public class ItemWeeklySalesPivotCellDto
    {
        public decimal Qty { get; set; }
        public decimal Amount { get; set; }
    }

    public class ItemWeeklySalesPivotRowDto
    {
        public Guid? ItemId { get; set; }
        public Guid? DepartmentId { get; set; }
        public string Department { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public string? Barcode { get; set; }
        /// <summary>Sparse map keyed by yyyy-MM-dd of the week-start date.</summary>
        public Dictionary<string, ItemWeeklySalesPivotCellDto> Cells { get; set; } = new();
    }

    public class ItemWeeklySalesPivotTotalsDto
    {
        public Dictionary<string, ItemWeeklySalesPivotCellDto> ByDate { get; set; } = new();
        public ItemWeeklySalesPivotCellDto Grand { get; set; } = new();
    }

    public class ItemWeeklySalesPivotResponseDto
    {
        /// <summary>Ordered list of yyyy-MM-dd week-start keys (ascending).</summary>
        public List<string> Dates { get; set; } = new();
        public List<ItemWeeklySalesPivotRowDto> Rows { get; set; } = new();
        public ItemWeeklySalesPivotTotalsDto Totals { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}

