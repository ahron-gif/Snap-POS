using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Sales Summary By Department report (SP_GetDepartmentSummary result set).
    /// </summary>
    public class SalesSummaryByDepartmentRowDto
    {
        public Guid? DepartmentID { get; set; }
        public string? Department { get; set; }
        public string? MainDepartment { get; set; }
        public string? SubDepartment { get; set; }
        public string? SubSubDepartment { get; set; }
        public decimal? Qty { get; set; }
        public decimal? QtyCase { get; set; }
        public decimal? ExtCost { get; set; }
        public decimal? ExtPrice { get; set; }
        public decimal? MarginPrice { get; set; }
        public decimal? MarkupPrice { get; set; }
        public decimal? Profit { get; set; }
        public decimal? TotalAfterDiscount { get; set; }
        public decimal? Discount { get; set; }
        public decimal? OnHand { get; set; }
        public decimal? OnOrder { get; set; }
        public string? StoreName { get; set; }
        public Guid? StoreID { get; set; }
        public decimal? SellThru { get; set; }
    }

    /// <summary>
    /// Request for Sales Summary By Department report.
    /// </summary>
    public class SalesSummaryByDepartmentRequestDto : PaginationGridDto
    {
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("fromTime")]
        public string? FromTime { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        [JsonProperty("toTime")]
        public string? ToTime { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }
    }

    /// <summary>
    /// Response for Sales Summary By Department report.
    /// </summary>
    public class SalesSummaryByDepartmentResponseDto
    {
        public List<SalesSummaryByDepartmentRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}
