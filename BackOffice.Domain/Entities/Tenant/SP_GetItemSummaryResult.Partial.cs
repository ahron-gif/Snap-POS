using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace BackOffice.Domain.Entities.Tenant
{
    /// <summary>
    /// Partial for SP_GetItemSummary result — columns match SP result set.
    /// </summary>
    public partial class SP_GetItemSummaryResult
    {
        public Guid? ItemStoreID { get; set; }
        public string? Name { get; set; }
        public string? Groups { get; set; }
        public string? ParentName { get; set; }
        public string? Color { get; set; }
        public string? Size { get; set; }
        public string? MainSize { get; set; }
        public string? ModalNumber { get; set; }
        public string? BarcodeNumber { get; set; }
        public string? ItemTypeName { get; set; }
        public string? Department { get; set; }
        public Guid? DepartmentID { get; set; }
        public string? MainDepartment { get; set; }
        public string? SubDepartment { get; set; }
        public string? SubSubDepartment { get; set; }
        public string? StyleNo { get; set; }
        public string? Supplier { get; set; }
        public string? ItemCodeSupplier { get; set; }
        public string? Brand { get; set; }
        public string? CustomerCode { get; set; }
        public decimal? Qty { get; set; }
        public decimal? QtyCase { get; set; }
        public decimal? ExtCost { get; set; }
        public decimal? ExtPrice { get; set; }

        [Column("Discount %")]
        public decimal? DiscountPct { get; set; }

        public decimal? MarginPrice { get; set; }
        public decimal? MarkupPrice { get; set; }
        public decimal? Profit { get; set; }
        public decimal? Discount { get; set; }
        public decimal? TotalAfterDiscount { get; set; }
        public string? StoreName { get; set; }
        public Guid? StoreID { get; set; }
        public Guid? ItemID { get; set; }
        public string? ParentCode { get; set; }
        public decimal? Price { get; set; }
        public decimal? OnHand { get; set; }
        public decimal? OnOrder { get; set; }
        public decimal? SellThru { get; set; }
        public DateTime? LastReceivedDate { get; set; }
        public decimal? LastReceivedQty { get; set; }
        public string? CustomField1 { get; set; }
        public string? CustomField2 { get; set; }
        public string? CustomField3 { get; set; }
        public string? CustomField4 { get; set; }
        public string? CustomField5 { get; set; }
        public string? CustomField6 { get; set; }
        public string? CustomField7 { get; set; }
        public string? CustomField8 { get; set; }
        public string? CustomField9 { get; set; }
        public string? CustomField10 { get; set; }
    }
}
