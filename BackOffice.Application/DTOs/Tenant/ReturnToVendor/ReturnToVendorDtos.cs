namespace BackOffice.Application.DTOs.Tenant.ReturnToVendor
{
    public class CreateReturnToVendorDto
    {
        public Guid? SupplierNo { get; set; }
        public Guid? StoreID { get; set; }
        public string? Note { get; set; }
        public DateTime? ReturnDate { get; set; }
        public string? Reason { get; set; }
        public List<CreateReturnToVendorEntryDto>? Entries { get; set; }
    }

    public class UpdateReturnToVendorDto : CreateReturnToVendorDto
    {
        public Guid ReturnToVendorID { get; set; }
    }

    public class CreateReturnToVendorEntryDto
    {
        public Guid? ItemNo { get; set; }
        public decimal? QtyReturned { get; set; }
        public decimal? Cost { get; set; }
        public decimal? ExtCost { get; set; }
        public string? Note { get; set; }
        public int? SortOrder { get; set; }
    }

    public class ReturnToVendorDetailDto
    {
        public Guid ReturnToVendorID { get; set; }
        public string? ReturnToVendorNo { get; set; }
        public Guid? SupplierNo { get; set; }
        public string? SupplierName { get; set; }
        public Guid? StoreID { get; set; }
        public string? StoreName { get; set; }
        public decimal? Total { get; set; }
        public string? Note { get; set; }
        public DateTime? ReturnDate { get; set; }
        public string? Reason { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public List<ReturnToVendorEntryDto>? Entries { get; set; }
    }

    public class ReturnToVendorEntryDto
    {
        public Guid EntryId { get; set; }
        public Guid? ItemNo { get; set; }
        public string? ItemName { get; set; }
        public string? ItemNumber { get; set; }
        public decimal? QtyReturned { get; set; }
        public decimal? Cost { get; set; }
        public decimal? ExtCost { get; set; }
        public string? Note { get; set; }
        public int? SortOrder { get; set; }
    }
}
