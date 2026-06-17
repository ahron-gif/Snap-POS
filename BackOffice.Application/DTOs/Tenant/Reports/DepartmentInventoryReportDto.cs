using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row per department with aggregated inventory totals.
    /// </summary>
    public class DepartmentInventoryDto
    {
        public Guid? DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public Guid? StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public int ItemCount { get; set; }
        public decimal TotalQtyOnHand { get; set; }
        public decimal TotalRetailValue { get; set; }
        public decimal TotalCostValue { get; set; }
    }

    /// <summary>
    /// Request for Department Inventory report (store and optional department filter, optional pagination).
    /// </summary>
    public class DepartmentInventoryRequestDto
    {
        public Guid? StoreId { get; set; }
        public Guid? DepartmentId { get; set; }
        public int StartRow { get; set; }
        public int EndRow { get; set; } = 100;
    }

    /// <summary>
    /// Response with one row per department (aggregated).
    /// </summary>
    public class DepartmentInventoryResponseDto
    {
        public List<DepartmentInventoryDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal GrandTotalQtyOnHand { get; set; }
        public decimal GrandTotalRetailValue { get; set; }
        public decimal GrandTotalCostValue { get; set; }
    }
}
