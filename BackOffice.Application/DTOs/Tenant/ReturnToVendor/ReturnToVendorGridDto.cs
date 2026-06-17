namespace BackOffice.Application.DTOs.Tenant.ReturnToVendor
{
    public class ReturnToVendorGridDto
    {
        public Guid ReturnToVenderID { get; set; }
        public string? ReturnToVenderNo { get; set; }
        public Guid? StoreNo { get; set; }
        public Guid? SupplierID { get; set; }
        public string? SupplierName { get; set; }
        public Guid? PersonReturnID { get; set; }
        public decimal? Total { get; set; }
        public string? Note { get; set; }
        public DateTime? ReturnToVenderDate { get; set; }
        public bool? Taxable { get; set; }
        public decimal? TaxRate { get; set; }
        public decimal? TaxAmount { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public Guid? UserCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public Guid? UserModified { get; set; }
        public decimal? Discount { get; set; }
        public bool? IsDiscountInAmount { get; set; }
    }
}
