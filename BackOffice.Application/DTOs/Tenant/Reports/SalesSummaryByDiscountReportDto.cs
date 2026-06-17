using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Sales Summary By Discount report (SP_GetDiscountSummary result set).
    /// </summary>
    public class SalesSummaryByDiscountRowDto
    {
        public Guid? DiscountID { get; set; }
        public string? Name { get; set; }
        public decimal? PercentsDiscount { get; set; }
        public decimal? AmountDiscount { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string? UPCDiscount { get; set; }
        public string? Status { get; set; }
        public int? CustomersNo { get; set; }
        public int? TransactionsCount { get; set; }
        public decimal? TotalQty { get; set; }
        public decimal? TotalBeforeDiscount { get; set; }
        public decimal? DiscountTotal { get; set; }
        public decimal? SalesTotalWithoutTax { get; set; }
        public decimal? SalesTotal { get; set; }
        public Guid? StoreID { get; set; }
        public string? StoreName { get; set; }
    }

    /// <summary>
    /// Request for Sales Summary By Discount report.
    /// </summary>
    public class SalesSummaryByDiscountRequestDto : PaginationGridDto
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

        /// <summary>
        /// Desktop parity: RepDiscountSummary's "Only Active" check-edit (CeOnlyActive).
        /// When true, the SP filter is augmented with
        ///   AND ((Discounts.StartDate &lt;= today AND Discounts.EndDate &gt;= today)
        ///        OR (Discounts.StartDate IS NULL AND Discounts.EndDate IS NULL))
        /// which is identical to the SP's own Status='Active' rule.
        /// </summary>
        [JsonProperty("activeOnly")]
        public bool? ActiveOnly { get; set; }
    }

    /// <summary>
    /// Response for Sales Summary By Discount report.
    /// </summary>
    public class SalesSummaryByDiscountResponseDto
    {
        public List<SalesSummaryByDiscountRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }

    /// <summary>
    /// Request for the Sales Summary By Discount drill-down (RepDiscountSummary row
    /// double-click -> RepDiscountDetails on the desktop). Backend uses the supplied
    /// DiscountId + date range + StoreId to build the SP_GetTransactionDiscount filter.
    /// </summary>
    public class SalesSummaryByDiscountDetailsRequestDto
    {
        [JsonProperty("discountId")]
        public Guid? DiscountId { get; set; }

        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }
    }

    /// <summary>
    /// One row of the Discount drill-down — matches SP_GetTransactionDiscount.
    /// </summary>
    public class SalesSummaryByDiscountDetailsRowDto
    {
        public Guid TransactionId { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        public DateTime? StartSaleTime { get; set; }
        public string CustomerNo { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public decimal? TotalBeforeDiscount { get; set; }
        public decimal? Discount { get; set; }
        public decimal? Qty { get; set; }
        public decimal? SaleTotal { get; set; }
        public decimal? SaleTotalWithoutTax { get; set; }
        public decimal? Paid { get; set; }
        public Guid? StoreId { get; set; }
    }

    public class SalesSummaryByDiscountDetailsResponseDto
    {
        public List<SalesSummaryByDiscountDetailsRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalQty { get; set; }
        public decimal TotalDiscount { get; set; }
        public decimal TotalSale { get; set; }
    }
}
