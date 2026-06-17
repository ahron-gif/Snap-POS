using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row from SP_GetDepartments - matches desktop RepDepartmentsValuation grid.
    /// </summary>
    public class DepartmentsValuationRowDto
    {
        public string MainDepartment { get; set; } = string.Empty;
        public string SubDepartment { get; set; } = string.Empty;
        public string SubSubDepartment { get; set; } = string.Empty;
        public Guid? DepartmentStoreID { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal OnHand { get; set; }
        public decimal OnOrder { get; set; }
        public decimal OnSaleOrder { get; set; }
        public decimal Cost { get; set; }
        public decimal AVGCost { get; set; }
        public decimal Price { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public Guid StoreID { get; set; }
    }

    /// <summary>
    /// Request for Departments Valuation report (same as desktop: optional store, optional as-of date).
    /// </summary>
    public class DepartmentsValuationRequestDto
    {
        public Guid? StoreId { get; set; }
        public DateTime? AsOfDate { get; set; }
    }

    /// <summary>
    /// API request model that accepts string values so empty string and grid payload (startRow, etc.) do not break binding.
    /// Controller parses these into DepartmentsValuationRequestDto.
    /// </summary>
    public class DepartmentsValuationApiRequestDto
    {
        public string? StoreId { get; set; }
        public string? AsOfDate { get; set; }
    }

    /// <summary>
    /// Response from SP_GetDepartments for Department Inventory report.
    /// </summary>
    public class DepartmentsValuationResponseDto
    {
        public List<DepartmentsValuationRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal GrandTotalOnHand { get; set; }
        public decimal GrandTotalOnOrder { get; set; }
        public decimal GrandTotalOnSaleOrder { get; set; }
        public decimal GrandTotalCost { get; set; }
        public decimal GrandTotalAVGCost { get; set; }
        public decimal GrandTotalPrice { get; set; }
    }
}
