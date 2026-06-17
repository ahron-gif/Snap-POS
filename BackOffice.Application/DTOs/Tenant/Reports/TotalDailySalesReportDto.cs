using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Total Daily Sales report: total sales per day.
    /// </summary>
    public class TotalDailySalesRowDto
    {
        /// <summary>
        /// Date column from Rpt_TotalSalesDaily (matches "Date" in desktop dataset).
        /// </summary>
        public DateTime Date { get; set; }

        /// <summary>
        /// Total column from Rpt_TotalSalesDaily (matches "Total" in desktop dataset).
        /// </summary>
        public decimal Total { get; set; }

        /// <summary>
        /// Trans column from Rpt_TotalSalesDaily (number of transactions).
        /// </summary>
        public int Trans { get; set; }

        /// <summary>
        /// AvgSale column from Rpt_TotalSalesDaily (average sale per transaction).
        /// </summary>
        public decimal AvgSale { get; set; }
    }

    /// <summary>
    /// Request for Total Daily Sales report.
    /// </summary>
    public class TotalDailySalesRequestDto : PaginationGridDto
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
        /// Optional department filter (guid). When set, only sales for that department are included (when supported by SP).
        /// </summary>
        [JsonProperty("departmentId")]
        public Guid? DepartmentId { get; set; }

        // ── Advanced "Filters" dialog (Item / Supplier / Customer tabs) ──────
        // Applied as EXISTS subqueries appended to @Filter (this SP's only hook):
        // Item/Supplier correlate to ItemsRepFilter; Customer to CustomerRepFilter.

        // Item tab
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

        // Supplier tab
        [JsonProperty("supplierIds")]        public List<Guid>? SupplierIds { get; set; }

        // Customer tab
        [JsonProperty("filterCustomerIds")]  public List<Guid>? FilterCustomerIds { get; set; }
        [JsonProperty("customerTypes")]      public List<int>? CustomerTypes { get; set; }
        [JsonProperty("customerGroupIds")]   public List<Guid>? CustomerGroupIds { get; set; }
        [JsonProperty("priceLevels")]        public List<int>? PriceLevels { get; set; }
        [JsonProperty("zips")]               public List<string>? Zips { get; set; }
        [JsonProperty("discountIds")]        public List<Guid>? DiscountIds { get; set; }
        [JsonProperty("taxable")]            public bool? Taxable { get; set; }
    }

    /// <summary>
    /// Response for Total Daily Sales report.
    /// </summary>
    public class TotalDailySalesResponseDto
    {
        public List<TotalDailySalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalAmount { get; set; }
        public int TotalTransactions { get; set; }
        public decimal AverageSale { get; set; }
    }
}

