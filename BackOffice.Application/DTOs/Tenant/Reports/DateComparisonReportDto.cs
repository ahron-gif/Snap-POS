using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Date Comparison report: department-level comparison of two periods (SP_GetDepartmentSummary called twice, merged by department).
    /// </summary>
    public class DateComparisonRowDto
    {
        public string? DepartmentName { get; set; }
        public decimal? Qty1 { get; set; }
        public decimal? ExtCost1 { get; set; }
        public decimal? ExtPrice1 { get; set; }
        public decimal? Qty2 { get; set; }
        public decimal? ExtCost2 { get; set; }
        public decimal? ExtPrice2 { get; set; }
        /// <summary>True for the summary total row appended at the end.</summary>
        public bool IsTotalRow { get; set; }
    }

    /// <summary>
    /// Request for Date Comparison report: compares two date ranges for a store.
    /// </summary>
    public class DateComparisonRequestDto
    {
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        [JsonProperty("comparisonFromDate")]
        public string? ComparisonFromDate { get; set; }

        [JsonProperty("comparisonToDate")]
        public string? ComparisonToDate { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }
    }

    /// <summary>
    /// Response for Date Comparison report.
    /// </summary>
    public class DateComparisonResponseDto
    {
        public List<DateComparisonRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}

