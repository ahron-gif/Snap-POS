using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Item Monthly Sales report: aggregated sales per item and month.
    /// </summary>
    public class ItemMonthlySalesRowDto
    {
        /// <summary>
        /// Start date of the month bucket (e.g. first day of month) in local store time.
        /// </summary>
        public DateTime MonthStartDate { get; set; }

        public int Year { get; set; }
        public string MonthName { get; set; } = string.Empty;

        public string ItemName { get; set; } = string.Empty;
        public string? BarcodeNumber { get; set; }
        public string? Department { get; set; }
        public Guid? DepartmentID { get; set; }
        public decimal Qty { get; set; }
        public decimal Total { get; set; }
        public decimal AveragePrice { get; set; }
    }

    /// <summary>
    /// Request for Item Monthly Sales report.
    /// </summary>
    public class ItemMonthlySalesRequestDto : PaginationGridDto
    {
        /// <summary>
        /// Inclusive from-date (yyyy-MM-dd). Defaults to today-365.
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
    /// Response for Item Monthly Sales report.
    /// </summary>
    public class ItemMonthlySalesResponseDto
    {
        public List<ItemMonthlySalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalQty { get; set; }
        public decimal TotalAmount { get; set; }
    }

    // -----------------------------------------------------------------------------------------
    // Pivot view — mirrors the desktop RepItemsMonthlySales DevExpress PivotGrid:
    //   Row fields:    Department > ItemName > Barcode
    //   Column fields: Year > Month (two-level column hierarchy)
    //   Data fields:   Amount, Qty
    //
    // Date keys are "YYYY-MM-01" (first day of month). The frontend builds the two-level
    // header by grouping consecutive month columns under their shared year.
    // -----------------------------------------------------------------------------------------

    public class ItemMonthlySalesPivotRequestDto
    {
        [JsonProperty("fromDate")] public string? FromDate { get; set; }
        [JsonProperty("toDate")]   public string? ToDate   { get; set; }
        [JsonProperty("storeId")]  public Guid?   StoreId  { get; set; }
        [JsonProperty("departmentId")] public Guid? DepartmentId { get; set; }
    }

    public class ItemMonthlySalesPivotCellDto
    {
        public decimal Qty { get; set; }
        public decimal Amount { get; set; }
    }

    public class ItemMonthlySalesPivotRowDto
    {
        public Guid? ItemId { get; set; }
        public Guid? DepartmentId { get; set; }
        public string Department { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public string? Barcode { get; set; }
        /// <summary>Sparse map keyed by yyyy-MM-01 (first day of month).</summary>
        public Dictionary<string, ItemMonthlySalesPivotCellDto> Cells { get; set; } = new();
    }

    public class ItemMonthlySalesPivotTotalsDto
    {
        public Dictionary<string, ItemMonthlySalesPivotCellDto> ByDate { get; set; } = new();
        public ItemMonthlySalesPivotCellDto Grand { get; set; } = new();
    }

    public class ItemMonthlySalesPivotResponseDto
    {
        /// <summary>Ordered list of yyyy-MM-01 keys (ascending).</summary>
        public List<string> Dates { get; set; } = new();
        public List<ItemMonthlySalesPivotRowDto> Rows { get; set; } = new();
        public ItemMonthlySalesPivotTotalsDto Totals { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}

