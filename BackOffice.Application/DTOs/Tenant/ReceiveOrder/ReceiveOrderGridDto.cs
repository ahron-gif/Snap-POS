namespace BackOffice.Application.DTOs.Tenant.ReceiveOrder
{
    public class ReceiveOrderGridDto
    {
        public Guid ReceiveID { get; set; }
        public string? PackingSlipNo { get; set; }
        public Guid? StoreID { get; set; }
        public Guid? SupplierNo { get; set; }
        public Guid? BillID { get; set; }
        public decimal? Freight { get; set; }
        public decimal? Discount { get; set; }
        public string? Note { get; set; }
        public decimal? Total { get; set; }
        public decimal? CurrBalance { get; set; }
        public bool? IsDiscAmount { get; set; }
        public decimal? DiscountSum { get; set; }
        public decimal? EntriesSum { get; set; }
        public DateTime? ReceiveOrderDate { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public Guid? UserCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public Guid? UserModified { get; set; }
        public string? BillNo { get; set; }
        public decimal? Amount { get; set; }
        public decimal? AmountPay { get; set; }
        public DateTime? BillDate { get; set; }
        public int? ReceiveStatus { get; set; }
        public decimal? Balance { get; set; }
        public Guid? TermsID { get; set; }
        public DateTime? StartSaleTime { get; set; }
        public string? SupplierName { get; set; }
        public string? SupplierCode { get; set; }
        public string? SupplierAddress { get; set; }
        public string? SupplierCSZ { get; set; }
        public string? PhoneNumber1 { get; set; }
        public string? ContactName { get; set; }
        public DateTime? BillDue { get; set; }
        public string? StoreName { get; set; }
        public string? AccountNo { get; set; }
        public decimal? CustomsDuties { get; set; }
        public decimal? OtherCharges { get; set; }
        public string? UserName { get; set; }
        public string? PoNo { get; set; }
    }
}
