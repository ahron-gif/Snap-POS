namespace BackOffice.Application.DTOs.Tenant.ReceiveOrder
{
    public class CreateReceiveOrderDto
    {
        public string? PackingSlipNo { get; set; }
        public Guid? StoreID { get; set; }
        public Guid? SupplierNo { get; set; }
        public Guid? BillID { get; set; }
        public decimal? Freight { get; set; }
        public decimal? Discount { get; set; }
        public string? Note { get; set; }
        public bool? IsDiscAmount { get; set; }
        public DateTime? ReceiveOrderDate { get; set; }
        public string? FilePath { get; set; }
        public decimal? CustomsDuties { get; set; }
        public decimal? OtherCharges { get; set; }
        public Guid? TermsID { get; set; }
        public Guid? BuyerID { get; set; }
        public Guid? BillToStoreID { get; set; }
        public string? VendorPONo { get; set; }
        public Guid? DepartmentID { get; set; }
        public Guid? SeasonID { get; set; }
        public List<CreateReceiveOrderEntryDto>? Entries { get; set; }
    }

    public class UpdateReceiveOrderDto : CreateReceiveOrderDto
    {
        public Guid ReceiveID { get; set; }
    }

    public class CreateReceiveOrderEntryDto
    {
        public Guid? ItemNo { get; set; }
        public decimal? QtyReceived { get; set; }
        public decimal? Cost { get; set; }
        public decimal? ExtCost { get; set; }
        public string? Note { get; set; }
        public int? SortOrder { get; set; }
    }

    public class ReceiveOrderDetailDto
    {
        public Guid ReceiveID { get; set; }
        public string? PackingSlipNo { get; set; }
        public Guid? StoreID { get; set; }
        public string? StoreName { get; set; }
        public Guid? SupplierNo { get; set; }
        public string? SupplierName { get; set; }
        public Guid? BillID { get; set; }
        public decimal? Freight { get; set; }
        public decimal? Discount { get; set; }
        public string? Note { get; set; }
        public decimal? Total { get; set; }
        public decimal? CurrBalance { get; set; }
        public bool? IsDiscAmount { get; set; }
        public DateTime? ReceiveOrderDate { get; set; }
        public short? Status { get; set; }
        public string? FilePath { get; set; }
        public decimal? CustomsDuties { get; set; }
        public decimal? OtherCharges { get; set; }
        public Guid? TermsID { get; set; }
        public Guid? BuyerID { get; set; }
        public Guid? BillToStoreID { get; set; }
        public string? VendorPONo { get; set; }
        public Guid? DepartmentID { get; set; }
        public Guid? SeasonID { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public List<ReceiveOrderEntryDto>? Entries { get; set; }
    }

    public class ReceiveOrderEntryDto
    {
        public Guid EntryId { get; set; }
        public Guid? ItemNo { get; set; }
        public string? ItemName { get; set; }
        public string? ItemNumber { get; set; }
        public decimal? QtyReceived { get; set; }
        public decimal? Cost { get; set; }
        public decimal? ExtCost { get; set; }
        public string? Note { get; set; }
        public int? SortOrder { get; set; }
    }
}
