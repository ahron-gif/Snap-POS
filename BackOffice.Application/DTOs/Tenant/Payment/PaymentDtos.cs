namespace BackOffice.Application.DTOs.Tenant.Payment
{
    public class CreatePaymentDto
    {
        public Guid? SupplierNo { get; set; }
        public Guid? StoreID { get; set; }
        public decimal? Amount { get; set; }
        public string? CheckNo { get; set; }
        public string? Note { get; set; }
        public DateTime? PaymentDate { get; set; }
        public int? PaymentMethod { get; set; }
        public Guid? BillID { get; set; }
    }

    public class UpdatePaymentDto : CreatePaymentDto
    {
        public Guid PaymentID { get; set; }
    }

    public class PaymentDetailDto
    {
        public Guid PaymentID { get; set; }
        public Guid? SupplierNo { get; set; }
        public string? SupplierName { get; set; }
        public Guid? StoreID { get; set; }
        public string? StoreName { get; set; }
        public decimal? Amount { get; set; }
        public string? CheckNo { get; set; }
        public string? Note { get; set; }
        public DateTime? PaymentDate { get; set; }
        public int? PaymentMethod { get; set; }
        public Guid? BillID { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }
}
