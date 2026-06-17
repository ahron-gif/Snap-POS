using System;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of Items on Receive Order report (Sp_PO_Receive_Report).
    /// Matches desktop RepReceivePO grid columns.
    /// </summary>
    public class ItemsOnReceiveOrderRowDto
    {
        public string StoreName { get; set; } = string.Empty;
        public Guid? ItemStoreID { get; set; }
        public string BarcodeNumber { get; set; } = string.Empty;
        public string ModalNumber { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string ManufacturerName { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public decimal? OnHand { get; set; }
        public string Supplier { get; set; } = string.Empty;
        public decimal? Cost { get; set; }
        public decimal? Price { get; set; }
        public decimal? QtyReceived { get; set; }
        public decimal? ReceivedValue { get; set; }
        public decimal? ReceivedSellingPrice { get; set; }
        public string MainDepartment { get; set; } = string.Empty;
        public string SubDepartment { get; set; } = string.Empty;
        public string SubSubDepartment { get; set; } = string.Empty;
        public string CustomField1 { get; set; } = string.Empty;
        public string CustomField2 { get; set; } = string.Empty;
        public string CustomField3 { get; set; } = string.Empty;
        public string CustomField4 { get; set; } = string.Empty;
        public string CustomField5 { get; set; } = string.Empty;
        public string CustomField6 { get; set; } = string.Empty;
        public string CustomField7 { get; set; } = string.Empty;
        public string CustomField8 { get; set; } = string.Empty;
        public string CustomField9 { get; set; } = string.Empty;
        public string CustomField10 { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request for Items on Receive Order report (Sp_PO_Receive_Report).
    /// Filter built like desktop: Store, BillDate range, Supplier IDs, optional Department.
    /// </summary>
    public class ItemsOnReceiveOrderRequestDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public Guid? StoreId { get; set; }
        /// <summary>Comma-separated supplier GUIDs for "Supplier.SupplierID in (...)"</summary>
        public string SupplierIds { get; set; } = string.Empty;
        /// <summary>Optional department filter (Filter2 / BuildDepartmentFilter).</summary>
        public string DepartmentFilter { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response for Items on Receive Order report.
    /// </summary>
    public class ItemsOnReceiveOrderResponseDto
    {
        public System.Collections.Generic.List<ItemsOnReceiveOrderRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}
