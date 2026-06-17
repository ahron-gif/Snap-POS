using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// Drill-down request for Tender Totals: same date/store/include-payout filters
    /// as the parent report plus a Cashier and optional Register/Location filter
    /// (one cell in the parent pivot identifies a unique Register+Cashier).
    /// Mirrors the desktop's RepTenders drill-down (double-click a cell to see
    /// the underlying transactions for that cashier).
    /// </summary>
    public class TenderTotalsDetailsRequestDto
    {
        [JsonProperty("fromDate")]
        public DateTime? FromDate { get; set; }

        [JsonProperty("toDate")]
        public DateTime? ToDate { get; set; }

        [JsonProperty("fromTime")]
        public string? FromTime { get; set; }

        [JsonProperty("toTime")]
        public string? ToTime { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }

        [JsonProperty("includePayOut")]
        public bool IncludePayOut { get; set; } = true;

        /// <summary>Cashier name from the parent pivot row.</summary>
        [JsonProperty("cashier")]
        public string? Cashier { get; set; }

        /// <summary>Register/Location label from the parent pivot row. Empty/null = all registers for this cashier.</summary>
        [JsonProperty("registerNo")]
        public string? RegisterNo { get; set; }
    }

    /// <summary>
    /// One transaction-level row for the Tender Totals drill-down grid.
    /// </summary>
    public class TenderTotalsDetailsRowDto
    {
        public string TransactionType { get; set; } = string.Empty;
        public string TenderType { get; set; } = string.Empty;
        public string CreditType { get; set; } = string.Empty;
        public string TransactionNo { get; set; } = string.Empty;
        public Guid? TransactionID { get; set; }
        public DateTime? TenderDate { get; set; }
        public decimal Amount { get; set; }
        public string Cashier { get; set; } = string.Empty;
        public string RegisterNo { get; set; } = string.Empty;
        public string CustomerNo { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string StoreName { get; set; } = string.Empty;
    }

    public class TenderTotalsDetailsResponseDto
    {
        public List<TenderTotalsDetailsRowDto> Rows { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal GrandTotalAmount { get; set; }
        public string Cashier { get; set; } = string.Empty;
        public string RegisterNo { get; set; } = string.Empty;
    }
}
