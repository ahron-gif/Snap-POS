using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Sales Summary By Specials report (Rpt_ItemsInSpecials or similar result set).
    /// </summary>
    public class SalesSummaryBySpecialsRowDto
    {
        public string? MainDepartment { get; set; }
        public string? SubDepartment { get; set; }
        public string? SubSubDepartment { get; set; }
        public string? Department { get; set; }
        public string? Name { get; set; }
        public string? BarcodeNumber { get; set; }
        public string? ModalNumber { get; set; }
        public Guid? ItemStoreID { get; set; }
        public Guid? ItemID { get; set; }
        public decimal? QtyCase { get; set; }
        public decimal? Qty { get; set; }
        public decimal? ExtCost { get; set; }
        public decimal? ExtSpecialPrice { get; set; }
        public decimal? ExtRegularPrice { get; set; }
        public decimal? MarginPrice { get; set; }
        public decimal? MarkupPrice { get; set; }
        public decimal? Profit { get; set; }
        public decimal? RegularProfit { get; set; }
        public decimal? Discount { get; set; }
        public decimal? TotalAfterDiscount { get; set; }
        public Guid? StoreID { get; set; }
        public string? StoreName { get; set; }
        public decimal? Price { get; set; }
        public decimal? OnHand { get; set; }
        public decimal? SpecialDeficit { get; set; }
    }

    /// <summary>
    /// Request for Sales Summary By Specials report.
    /// </summary>
    public class SalesSummaryBySpecialsRequestDto : PaginationGridDto
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
    /// Response for Sales Summary By Specials report.
    /// </summary>
    public class SalesSummaryBySpecialsResponseDto
    {
        public List<SalesSummaryBySpecialsRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}
