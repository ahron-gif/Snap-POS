using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of Tender Totals report (legacy flat): totals by tender type/credit type.
    /// </summary>
    public class TenderTotalsRowDto
    {
        public string TenderType { get; set; } = string.Empty;
        public string CreditType { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public int? TenderTypeInt { get; set; }
        public int? Count { get; set; }
        public int? SortOrder { get; set; }
    }

    /// <summary>
    /// One row of Tender Totals report (desktop-style pivot): grouped by Location (Register) and Cashier, with amounts per tender/credit type.
    /// </summary>
    public class TenderTotalsPivotRowDto
    {
        /// <summary>Register / Location.</summary>
        public string RegisterNo { get; set; } = string.Empty;
        public string Cashier { get; set; } = string.Empty;
        /// <summary>Amounts by tender column name (e.g. CASH, CHECK, AMEX, Discover, Visa).</summary>
        public Dictionary<string, decimal> TenderAmounts { get; set; } = new Dictionary<string, decimal>();
    }

    /// <summary>
    /// Request for Tender Totals report: date/time range, store, Include Payout (matches desktop).
    /// </summary>
    public class TenderTotalsRequestDto
    {
        [JsonProperty("fromDate")]
        public DateTime? FromDate { get; set; }

        [JsonProperty("toDate")]
        public DateTime? ToDate { get; set; }

        /// <summary>Optional time for FromDate (e.g. "00:00" for 12:00 AM). Applied when FromDate has no time.</summary>
        [JsonProperty("fromTime")]
        public string? FromTime { get; set; }

        /// <summary>Optional time for ToDate (e.g. "23:59" or "11:59:59 PM"). Applied when ToDate has no time.</summary>
        [JsonProperty("toTime")]
        public string? ToTime { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }

        /// <summary>
        /// Whether to include payouts in totals. Matches desktop "Include Payout" checkbox.
        /// </summary>
        [JsonProperty("includePayOut")]
        public bool IncludePayOut { get; set; } = true;
    }

    /// <summary>
    /// Response for Tender Totals report (pivot by Register and Cashier, columns = tender types).
    /// </summary>
    public class TenderTotalsResponseDto
    {
        /// <summary>Pivot rows: one per (Register, Cashier) with amounts per tender column.</summary>
        public List<TenderTotalsPivotRowDto> Data { get; set; } = new();
        /// <summary>Ordered list of tender column names for the grid (e.g. CASH, CHECK, AMEX, Discover, Visa).</summary>
        public List<string> TenderColumnNames { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalAmount { get; set; }
    }
}

