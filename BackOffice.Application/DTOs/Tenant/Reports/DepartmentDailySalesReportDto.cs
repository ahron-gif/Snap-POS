using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Department Daily Sales report: aggregated sales per department and day.
    /// </summary>
    public class DepartmentDailySalesRowDto
    {
        public DateTime SaleDate { get; set; }
        public Guid? StoreID { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public Guid? DepartmentID { get; set; }
        public decimal Qty { get; set; }
        public decimal Total { get; set; }
    }

    /// <summary>
    /// Request for Department Daily Sales report.
    /// </summary>
    public class DepartmentDailySalesRequestDto : PaginationGridDto
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
    }

    /// <summary>
    /// Response for Department Daily Sales report.
    /// </summary>
    public class DepartmentDailySalesResponseDto
    {
        public List<DepartmentDailySalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalQty { get; set; }
        public decimal TotalAmount { get; set; }
    }

    // -----------------------------------------------------------------------------------------
    // Pivot view — mirrors desktop RepDepartmentDailySales:
    //   Row fields:   Date > StoreName  (sticky LEFT)
    //   Column field: Department        (scrolling RIGHT)
    //   Data fields:  Amount, Qty       (sub-cols under each department)
    //
    // Note this is INVERTED from the item pivots: there, departments live in row groups and
    // dates live in columns. Here it's the other way round — dates live in rows and
    // departments are the scrolling columns, matching the desktop layout.
    // -----------------------------------------------------------------------------------------

    public class DepartmentDailySalesPivotRequestDto
    {
        [JsonProperty("fromDate")] public string? FromDate { get; set; }
        [JsonProperty("toDate")]   public string? ToDate   { get; set; }
        [JsonProperty("storeId")]  public Guid?   StoreId  { get; set; }
    }

    public class DepartmentDailySalesPivotCellDto
    {
        public decimal Qty { get; set; }
        public decimal Amount { get; set; }
    }

    /// <summary>One row = a unique (date, store) combination with sparse cells per department.</summary>
    public class DepartmentDailySalesPivotRowDto
    {
        public string Date { get; set; } = string.Empty;       // yyyy-MM-dd
        public Guid?  StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
        /// <summary>Sparse map keyed by department name (matches the column key on the right side).</summary>
        public Dictionary<string, DepartmentDailySalesPivotCellDto> Cells { get; set; } = new();
    }

    /// <summary>One column descriptor — surfaces both the name and the ID so drill-downs can pass the ID.</summary>
    public class DepartmentDailySalesPivotColumnDto
    {
        public string Name { get; set; } = string.Empty;
        public Guid?  Id { get; set; }
    }

    public class DepartmentDailySalesPivotTotalsDto
    {
        /// <summary>Per-department column totals, keyed by department name.</summary>
        public Dictionary<string, DepartmentDailySalesPivotCellDto> ByDepartment { get; set; } = new();
        public DepartmentDailySalesPivotCellDto Grand { get; set; } = new();
    }

    public class DepartmentDailySalesPivotResponseDto
    {
        /// <summary>Department columns in name order (frontend can re-sort).</summary>
        public List<DepartmentDailySalesPivotColumnDto> Departments { get; set; } = new();
        public List<DepartmentDailySalesPivotRowDto> Rows { get; set; } = new();
        public DepartmentDailySalesPivotTotalsDto Totals { get; set; } = new();
        public int TotalRecords { get; set; }
    }

    // -----------------------------------------------------------------------------------------
    // Department WEEKLY Sales pivot — mirrors desktop RepDepartmentWeeklySales.
    //   Row fields:   Department > Store         (sticky LEFT)
    //   Column field: WeekStart (yyyy-MM-dd)     (scrolling RIGHT)
    //   Data fields:  Amount, Qty                (sub-cols under each week)
    // -----------------------------------------------------------------------------------------
    public class DepartmentWeeklySalesPivotRequestDto
    {
        [JsonProperty("fromDate")] public string? FromDate { get; set; }
        [JsonProperty("toDate")]   public string? ToDate   { get; set; }
        [JsonProperty("storeId")]  public Guid?   StoreId  { get; set; }
    }
    public class DepartmentWeeklySalesPivotCellDto
    {
        public decimal Qty { get; set; }
        public decimal Amount { get; set; }
    }
    /// <summary>One row = a unique (Department, Store) combination with sparse per-week cells.</summary>
    public class DepartmentWeeklySalesPivotRowDto
    {
        public Guid?  DepartmentId { get; set; }
        public string Department { get; set; } = string.Empty;
        public Guid?  StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
        /// <summary>Sparse map keyed by week-start date (yyyy-MM-dd).</summary>
        public Dictionary<string, DepartmentWeeklySalesPivotCellDto> Cells { get; set; } = new();
    }
    public class DepartmentWeeklySalesPivotTotalsDto
    {
        public Dictionary<string, DepartmentWeeklySalesPivotCellDto> ByWeek { get; set; } = new();
        public DepartmentWeeklySalesPivotCellDto Grand { get; set; } = new();
    }
    public class DepartmentWeeklySalesPivotResponseDto
    {
        /// <summary>Ordered list of yyyy-MM-dd week-start keys (ascending).</summary>
        public List<string> Weeks { get; set; } = new();
        public List<DepartmentWeeklySalesPivotRowDto> Rows { get; set; } = new();
        public DepartmentWeeklySalesPivotTotalsDto Totals { get; set; } = new();
        public int TotalRecords { get; set; }
    }

    // -----------------------------------------------------------------------------------------
    // Department MONTHLY Sales pivot — mirrors desktop RepDepartmentMonthlySales.
    //   Row fields:    Year > Month                 (sticky LEFT, Year is a row super-group)
    //   Column fields: Department > Store           (scrolling RIGHT, Department is a col super-group)
    //   Data fields:   Amount, Qty                  (sub-cols under each Store column)
    // -----------------------------------------------------------------------------------------
    public class DepartmentMonthlySalesPivotRequestDto
    {
        [JsonProperty("fromDate")] public string? FromDate { get; set; }
        [JsonProperty("toDate")]   public string? ToDate   { get; set; }
        [JsonProperty("storeId")]  public Guid?   StoreId  { get; set; }
    }
    public class DepartmentMonthlySalesPivotCellDto
    {
        public decimal Qty { get; set; }
        public decimal Amount { get; set; }
    }
    /// <summary>A (Department, Store) column on the right. Cells are keyed by Key.</summary>
    public class DepartmentMonthlySalesPivotColumnDto
    {
        /// <summary>Stable cell-lookup key — formatted as "deptName|storeName".</summary>
        public string Key { get; set; } = string.Empty;
        public Guid?  DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public Guid?  StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
    }
    /// <summary>One row = one (Year, Month) bucket with sparse cells per (dept, store) column.</summary>
    public class DepartmentMonthlySalesPivotRowDto
    {
        public int Year { get; set; }
        public int Month { get; set; }              // 1-12
        public string MonthName { get; set; } = string.Empty;
        /// <summary>Stable row identifier — "yyyy-MM" so client can re-sort.</summary>
        public string MonthKey { get; set; } = string.Empty;
        /// <summary>Sparse map keyed by the column's Key.</summary>
        public Dictionary<string, DepartmentMonthlySalesPivotCellDto> Cells { get; set; } = new();
    }
    public class DepartmentMonthlySalesPivotTotalsDto
    {
        /// <summary>Per-column totals keyed by the same column Key.</summary>
        public Dictionary<string, DepartmentMonthlySalesPivotCellDto> ByColumn { get; set; } = new();
        public DepartmentMonthlySalesPivotCellDto Grand { get; set; } = new();
    }
    public class DepartmentMonthlySalesPivotResponseDto
    {
        public List<DepartmentMonthlySalesPivotColumnDto> Columns { get; set; } = new();
        public List<DepartmentMonthlySalesPivotRowDto> Rows { get; set; } = new();
        public DepartmentMonthlySalesPivotTotalsDto Totals { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}

