namespace BackOffice.Application.DTOs.Tenant.PurchaseOrder
{
    public class PurchaseOrderGridDto
    {
        public Guid PurchaseOrderId { get; set; }
        public string? PoNo { get; set; }
        public decimal? GrandTotal { get; set; }
        public DateTime? PurchaseOrderDate { get; set; }
        public DateTime? ReqDate { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public bool? Reorder { get; set; }
        public string? Note { get; set; }
        public string? VendorPONo { get; set; }
        public int OpenItemsCount { get; set; }
        public string? StoreName { get; set; }
        public string? User { get; set; }
        public string? Supplier { get; set; }
        public string? Supplier_No { get; set; }
        public short? POStatus { get; set; }
        public string? EmailAddress { get; set; }
        public bool? Sent { get; set; }
        public Guid? ClassID { get; set; }
        public decimal? MinMarkup { get; set; }
        public decimal? ListPrice { get; set; }
        public short? Import { get; set; }
        public bool? Approved { get; set; }
        public Guid? StoreNo { get; set; }
        public short? Status { get; set; }
    }
}
