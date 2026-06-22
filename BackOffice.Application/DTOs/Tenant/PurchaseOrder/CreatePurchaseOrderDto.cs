namespace BackOffice.Application.DTOs.Tenant.PurchaseOrder
{
    public class CreatePurchaseOrderDto
    {
        public Guid? SupplierNo { get; set; }
        public Guid? StoreNo { get; set; }
        public string? PoNo { get; set; }
        public Guid? PersonOrderdId { get; set; }
        public Guid? ShipVia { get; set; }
        public Guid? ShipTo { get; set; }
        public string? TrackNo { get; set; }
        public Guid? TermsNo { get; set; }
        public DateTime? PurchaseOrderDate { get; set; }
        public DateTime? ReqDate { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public bool? Shipdrop { get; set; }
        public short? POStatus { get; set; }
        public string? Note { get; set; }
        public bool? Reorder { get; set; }
        public Guid? TermsID { get; set; }
        public Guid? BuyerID { get; set; }
        public Guid? BillToStoreID { get; set; }
        public string? VendorPONo { get; set; }
        public Guid? DepartmentID { get; set; }
        public Guid? SeasonID { get; set; }
        public Guid? ClassID { get; set; }
        public decimal? MinMarkup { get; set; }
        public decimal? ListPrice { get; set; }
        public short? Import { get; set; }
        public List<CreatePurchaseOrderEntryDto>? Entries { get; set; }
    }

    public class UpdatePurchaseOrderDto : CreatePurchaseOrderDto
    {
        public Guid PurchaseOrderId { get; set; }
    }

    public class CreatePurchaseOrderEntryDto
    {
        public Guid? ItemNo { get; set; }
        public decimal? QtyOrdered { get; set; }
        public decimal? PricePerUnit { get; set; }
        public int? UOMQty { get; set; }
        public int? UOMType { get; set; }
        public decimal? ExtPrice { get; set; }
        public bool? IsSpecialPrice { get; set; }
        public string? Note { get; set; }
        public int? SortOrder { get; set; }
        public decimal? CostBeforeDis { get; set; }
        public decimal? EstimateCost { get; set; }
        public decimal? NetCost { get; set; }
        public decimal? SpecialCost { get; set; }
        public decimal? Discount { get; set; }
        public int? DiscountType { get; set; }
    }

    public class PurchaseOrderDetailDto
    {
        public Guid PurchaseOrderId { get; set; }
        public Guid? SupplierNo { get; set; }
        public string? SupplierName { get; set; }
        public Guid? StoreNo { get; set; }
        public string? StoreName { get; set; }
        public string? PoNo { get; set; }
        public Guid? PersonOrderdId { get; set; }
        public decimal? GrandTotal { get; set; }
        public Guid? ShipVia { get; set; }
        public Guid? ShipTo { get; set; }
        public string? TrackNo { get; set; }
        public Guid? TermsNo { get; set; }
        public DateTime? PurchaseOrderDate { get; set; }
        public DateTime? ReqDate { get; set; }
        public DateTime? ExpirationDate { get; set; }
        public bool? Shipdrop { get; set; }
        public short? POStatus { get; set; }
        public string? Note { get; set; }
        public bool? Reorder { get; set; }
        public short? Status { get; set; }
        public Guid? TermsID { get; set; }
        public Guid? BuyerID { get; set; }
        public Guid? BillToStoreID { get; set; }
        public string? VendorPONo { get; set; }
        public Guid? DepartmentID { get; set; }
        public Guid? SeasonID { get; set; }
        public Guid? ClassID { get; set; }
        public decimal? MinMarkup { get; set; }
        public decimal? ListPrice { get; set; }
        public short? Import { get; set; }
        public bool? Sent { get; set; }
        public bool? Approved { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public List<PurchaseOrderEntryDto>? Entries { get; set; }
    }

    public class PurchaseOrderEntryDto
    {
        public Guid PurchaseOrderEntryId { get; set; }
        public Guid? ItemNo { get; set; }
        public string? ItemName { get; set; }
        public string? ItemNumber { get; set; }
        public decimal? QtyOrdered { get; set; }
        public decimal? PricePerUnit { get; set; }
        public int? UOMQty { get; set; }
        public int? UOMType { get; set; }
        public decimal? ExtPrice { get; set; }
        public bool? IsSpecialPrice { get; set; }
        public string? Note { get; set; }
        public int? SortOrder { get; set; }
        public decimal? CostBeforeDis { get; set; }
        public decimal? EstimateCost { get; set; }
        public decimal? NetCost { get; set; }
        public decimal? SpecialCost { get; set; }
        public decimal? Discount { get; set; }
        public int? DiscountType { get; set; }
    }
}
