using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row per item with aggregated inventory totals (grouped by item across stores).
    /// </summary>
    public class ItemInventorySummaryDto
    {
        public Guid ItemId { get; set; }
        public string ItemNo { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public string DepartmentName { get; set; } = string.Empty;
        public int ItemCount { get; set; }
        public decimal TotalQtyOnHand { get; set; }
        public decimal TotalRetailValue { get; set; }
        public decimal TotalCostValue { get; set; }
    }

    /// <summary>
    /// Request for Item Inventory Summary report (store and optional department filter, pagination).
    /// </summary>
    public class ItemInventorySummaryRequestDto
    {
        public Guid? StoreId { get; set; }
        public Guid? DepartmentId { get; set; }
        public int StartRow { get; set; }
        public int EndRow { get; set; } = 100;
    }

    /// <summary>
    /// Response with one row per item (aggregated).
    /// </summary>
    public class ItemInventorySummaryResponseDto
    {
        public List<ItemInventorySummaryDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal GrandTotalQtyOnHand { get; set; }
        public decimal GrandTotalRetailValue { get; set; }
        public decimal GrandTotalCostValue { get; set; }
    }
}
