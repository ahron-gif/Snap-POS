using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Total Monthly Sales report: total sales per month.
    /// Uses the dataset shape from Rpt_TotalSalesMonthly (Date, Total, Trans, AvgSale, Yr, Mt).
    /// </summary>
    public class TotalMonthlySalesRowDto
    {
        public DateTime MonthStartDate { get; set; }
        public int Year { get; set; }
        public int Month { get; set; }
        public decimal Total { get; set; }
        public int Trans { get; set; }
        public decimal AvgSale { get; set; }
        public decimal Cost { get; set; }
        public decimal Tax { get; set; }
    }

    /// <summary>
    /// Request for Total Monthly Sales report.
    /// </summary>
    public class TotalMonthlySalesRequestDto : PaginationGridDto
    {
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        /// <summary>
        /// Optional department filter (guid). When set, only sales for that department are included (when supported by SP).
        /// </summary>
        [JsonProperty("departmentId")]
        public Guid? DepartmentId { get; set; }

        // ── Advanced "Filters" dialog (Item / Supplier / Customer tabs) — applied
        // as EXISTS subqueries on @Filter (see ReportService). ──────────────────
        [JsonProperty("itemIds")]            public List<Guid>? ItemIds { get; set; }
        [JsonProperty("itemDepartmentIds")]  public List<Guid>? ItemDepartmentIds { get; set; }
        [JsonProperty("includeSubDept")]     public bool? IncludeSubDept { get; set; }
        [JsonProperty("manufacturerIds")]    public List<Guid>? ManufacturerIds { get; set; }
        [JsonProperty("itemTypes")]          public List<int>? ItemTypes { get; set; }
        [JsonProperty("itemGroupIds")]       public List<string>? ItemGroupIds { get; set; }
        [JsonProperty("isDiscount")]         public bool? IsDiscount { get; set; }
        [JsonProperty("isTaxable")]          public bool? IsTaxable { get; set; }
        [JsonProperty("isFoodStampable")]    public bool? IsFoodStampable { get; set; }
        [JsonProperty("isWic")]              public bool? IsWic { get; set; }
        [JsonProperty("supplierIds")]        public List<Guid>? SupplierIds { get; set; }
        [JsonProperty("filterCustomerIds")]  public List<Guid>? FilterCustomerIds { get; set; }
        [JsonProperty("customerTypes")]      public List<int>? CustomerTypes { get; set; }
        [JsonProperty("customerGroupIds")]   public List<Guid>? CustomerGroupIds { get; set; }
        [JsonProperty("priceLevels")]        public List<int>? PriceLevels { get; set; }
        [JsonProperty("zips")]               public List<string>? Zips { get; set; }
        [JsonProperty("discountIds")]        public List<Guid>? DiscountIds { get; set; }
        [JsonProperty("taxable")]            public bool? Taxable { get; set; }
    }

    /// <summary>
    /// Response for Total Monthly Sales report.
    /// </summary>
    public class TotalMonthlySalesResponseDto
    {
        public List<TotalMonthlySalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalAmount { get; set; }
        public int TotalTransactions { get; set; }
        public decimal AverageSale { get; set; }
    }
}

