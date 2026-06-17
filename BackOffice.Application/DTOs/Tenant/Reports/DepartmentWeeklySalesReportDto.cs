using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Department Weekly Sales report: aggregated sales per department and week.
    /// </summary>
    public class DepartmentWeeklySalesRowDto
    {
        public DateTime WeekStartDate { get; set; }
        public Guid? StoreID { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public Guid? DepartmentID { get; set; }
        public decimal Qty { get; set; }
        public decimal Total { get; set; }
    }

    /// <summary>
    /// Request for Department Weekly Sales report.
    /// </summary>
    public class DepartmentWeeklySalesRequestDto : PaginationGridDto
    {
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }
    }

    /// <summary>
    /// Response for Department Weekly Sales report.
    /// </summary>
    public class DepartmentWeeklySalesResponseDto
    {
        public List<DepartmentWeeklySalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalQty { get; set; }
        public decimal TotalAmount { get; set; }
    }
}

