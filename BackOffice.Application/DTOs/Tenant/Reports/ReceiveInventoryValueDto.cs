using System;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of Receive Inventory Value report (Sp_rptRecicveValue).
    /// Matches desktop RptReceiveValue grid: Department, Qty, StoreName, Cost, Price, MainDepartment, SubDepartment, SubSubDepartment.
    /// </summary>
    public class ReceiveInventoryValueRowDto
    {
        public string MainDepartment { get; set; } = string.Empty;
        public string SubDepartment { get; set; } = string.Empty;
        public string SubSubDepartment { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public decimal? Qty { get; set; }
        public decimal? Cost { get; set; }
        public decimal? Price { get; set; }
        public string StoreName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request for Receive Inventory Value report (Sp_rptRecicveValue).
    /// Filter: Store, ReceiveOrderDate range, Department, Supplier, Brand (desktop GetFilter).
    /// </summary>
    public class ReceiveInventoryValueRequestDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public Guid? StoreId { get; set; }
        public string SupplierIds { get; set; } = string.Empty;
        public string DepartmentIds { get; set; } = string.Empty;
        public string BrandNames { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response for Receive Inventory Value report.
    /// </summary>
    public class ReceiveInventoryValueResponseDto
    {
        public System.Collections.Generic.List<ReceiveInventoryValueRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}
