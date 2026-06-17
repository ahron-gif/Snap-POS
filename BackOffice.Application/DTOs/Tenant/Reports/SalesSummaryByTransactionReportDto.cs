using System;
using System.Collections.Generic;
using BackOffice.Application.Converters;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One transaction row for Sales Summary By Transaction report (desktop clone).
    /// `TransactionId` is exposed so the row double-click drill-down can fetch the per-line
    /// profit breakdown via SP_GetEntryProfit (desktop's RepSalesProfit -> RepEntryProfit).
    /// </summary>
    public class SalesSummaryByTransactionRowDto
    {
        public string StoreName { get; set; } = string.Empty;
        public string No { get; set; } = string.Empty;
        public string CustomerNo { get; set; } = string.Empty;
        public DateTime? Date { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public decimal? DiscountPercent { get; set; }
        public string User { get; set; } = string.Empty;
        public decimal? Total { get; set; }
        public decimal? SubTotal { get; set; }
        public decimal? DiscountAmount { get; set; }
        public decimal? Tax { get; set; }
        public decimal? Markup { get; set; }
        public decimal? Margin { get; set; }
        public decimal? Profit { get; set; }
        public string StoreName2 { get; set; } = string.Empty; // Store Name (second column per desktop layout)
        public Guid? TransactionId { get; set; }
    }

    /// <summary>
    /// Request for Sales Summary By Transaction report (desktop clone).
    /// </summary>
    public class SalesSummaryByTransactionRequestDto : PaginationGridDto
    {
        [JsonProperty("scope")]
        public string? Scope { get; set; }

        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("fromTime")]
        public string? FromTime { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        [JsonProperty("toTime")]
        public string? ToTime { get; set; }

        [JsonProperty("customerId")]
        [JsonConverter(typeof(NullableGuidJsonConverter))]
        public Guid? CustomerId { get; set; }

        [JsonProperty("customerFilter")]
        public string? CustomerFilter { get; set; }

        [JsonProperty("userId")]
        [JsonConverter(typeof(NullableGuidJsonConverter))]
        public Guid? UserId { get; set; }

        [JsonProperty("userFilter")]
        public string? UserFilter { get; set; }

        [JsonProperty("storeId")]
        [JsonConverter(typeof(NullableGuidJsonConverter))]
        public Guid? StoreId { get; set; }

        [JsonProperty("onlyRegister")]
        public bool? OnlyRegister { get; set; }
    }

    /// <summary>
    /// Response for Sales Summary By Transaction report.
    /// </summary>
    public class SalesSummaryByTransactionResponseDto
    {
        public List<SalesSummaryByTransactionRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }

    /// <summary>
    /// Request for the Sales Summary By Transaction drill-down — opened when the user
    /// double-clicks a transaction row in the parent report. Backend calls SP_GetEntryProfit
    /// with the supplied transaction ID and returns the per-line profit breakdown.
    /// </summary>
    public class SalesSummaryByTransactionDetailsRequestDto
    {
        [JsonProperty("transactionId")]
        public Guid? TransactionId { get; set; }
    }

    /// <summary>
    /// One line in the per-transaction drill-down — shape matches SP_GetEntryProfit.
    /// </summary>
    public class SalesSummaryByTransactionDetailsRowDto
    {
        public string Name { get; set; } = string.Empty;
        public decimal? UOMPrice { get; set; }
        public decimal? UOMQty { get; set; }
        public decimal? Total { get; set; }
        public decimal? Cost { get; set; }
        public decimal? DiscountPerc { get; set; }
        public decimal? DiscountAmount { get; set; }
        public decimal? TotalAfterDiscount { get; set; }
        public decimal? Markup { get; set; }
        public decimal? Margin { get; set; }
        public decimal? Profit { get; set; }
        public decimal? DiscountOnTotal { get; set; }
    }

    public class SalesSummaryByTransactionDetailsResponseDto
    {
        public List<SalesSummaryByTransactionDetailsRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalProfit { get; set; }
        public decimal TotalCost { get; set; }
        public decimal TotalAmount { get; set; }
    }
}
