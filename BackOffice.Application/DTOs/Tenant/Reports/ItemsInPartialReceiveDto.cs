using System;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of Items in Partial Receive report (Sp_rptOpenPartialPO).
    /// Matches desktop RepPartialPO grid columns.
    /// </summary>
    public class ItemsInPartialReceiveRowDto
    {
        public string StoreName { get; set; } = string.Empty;
        public Guid? StoreID { get; set; }
        public DateTime? PurchaseOrderDate { get; set; }
        public string PoNo { get; set; } = string.Empty;
        public string SupplierNo { get; set; } = string.Empty;
        public string SupplierName { get; set; } = string.Empty;
        public string UPC { get; set; } = string.Empty;
        public decimal? QtyOrdered { get; set; }
        public decimal? ReceivedQty { get; set; }
        public string ModalNumber { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public Guid? ItemStoreID { get; set; }
        public Guid? ItemID { get; set; }
        public string Brand { get; set; } = string.Empty;
        public decimal? TotalCost { get; set; }
        public decimal? TotalPrice { get; set; }
        public string Groups { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request for Items in Partial Receive report (Sp_rptOpenPartialPO).
    /// Filter: Store, PurchaseOrderDate range, Department, Supplier, Brand (desktop GetFilter).
    /// </summary>
    public class ItemsInPartialReceiveRequestDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public Guid? StoreId { get; set; }
        public string SupplierIds { get; set; } = string.Empty;
        public string DepartmentIds { get; set; } = string.Empty;
        public string BrandNames { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response for Items in Partial Receive report.
    /// </summary>
    public class ItemsInPartialReceiveResponseDto
    {
        public System.Collections.Generic.List<ItemsInPartialReceiveRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}
