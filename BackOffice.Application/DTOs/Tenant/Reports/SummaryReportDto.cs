using System;
using System.Collections.Generic;
using BackOffice.Application.Converters;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of the Summary report: two columns from Get_SummaryReport SP — label (e.g. "No. of Sales", "Sales") and value (e.g. "0", "$0.00").
    /// </summary>
    public class SummaryReportRowDto
    {
        public string Label { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request for Summary report: date range and optional store.
    /// Dates as strings (yyyy-MM-dd) for reliable binding from frontend.
    /// </summary>
    public class SummaryReportRequestDto
    {
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        [JsonProperty("storeId")]
        [JsonConverter(typeof(NullableGuidJsonConverter))]
        public Guid? StoreId { get; set; }

        [JsonProperty("loadAllChecks")]
        public bool? LoadAllChecks { get; set; }

        // ── Advanced "Filters" dialog — Customer tab (multi-select) ──────────
        // Built into the SP's @CustomerFilter as `AND <col> IN (...)` against
        // CustomerRepFilter (same mechanism as Tax Collected). Sent under
        // `filterCustomerIds` to avoid colliding with any int customerId key.
        [JsonProperty("filterCustomerIds")]
        public List<Guid>? FilterCustomerIds { get; set; }

        [JsonProperty("customerTypes")]
        public List<int>? CustomerTypes { get; set; }

        [JsonProperty("customerGroupIds")]
        public List<Guid>? CustomerGroupIds { get; set; }

        [JsonProperty("priceLevels")]
        public List<int>? PriceLevels { get; set; }

        [JsonProperty("zips")]
        public List<string>? Zips { get; set; }

        [JsonProperty("discountIds")]
        public List<Guid>? DiscountIds { get; set; }

        [JsonProperty("taxable")]
        public bool? Taxable { get; set; }
    }

    /// <summary>
    /// Response for Summary report.
    /// </summary>
    public class SummaryReportResponseDto
    {
        public List<SummaryReportRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}
