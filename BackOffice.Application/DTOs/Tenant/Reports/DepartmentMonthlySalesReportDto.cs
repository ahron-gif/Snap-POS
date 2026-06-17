using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row for Department Monthly Sales report: aggregated sales per department and month.
    /// </summary>
    public class DepartmentMonthlySalesRowDto
    {
        public DateTime MonthStartDate { get; set; }
        public int Year { get; set; }
        public string MonthName { get; set; } = string.Empty;
        public Guid? StoreID { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public Guid? DepartmentID { get; set; }
        public decimal Qty { get; set; }
        public decimal Total { get; set; }
    }

    /// <summary>
    /// Request for Department Monthly Sales report.
    /// </summary>
    public class DepartmentMonthlySalesRequestDto : PaginationGridDto
    {
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }
    }

    /// <summary>
    /// Response for Department Monthly Sales report.
    /// </summary>
    public class DepartmentMonthlySalesResponseDto
    {
        public List<DepartmentMonthlySalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalQty { get; set; }
        public decimal TotalAmount { get; set; }
    }
}

