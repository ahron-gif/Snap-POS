namespace BackOffice.Application.DTOs.Tenant.ReceivePayment
{
    public class ReceivePaymentGridDto
    {
        public Guid TransactionID { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerNo { get; set; }
        public decimal? Credit { get; set; }
        public decimal? AppliedAmount { get; set; }
        public decimal? Balance { get; set; }
        public string? TenderName { get; set; }
        public DateTime? TenderDate { get; set; }
        public string? Common1 { get; set; }
        public DateTime? StartSaleTime { get; set; }
        public short? Status { get; set; }
        public string? VoidReason { get; set; }
        public string? StoreName { get; set; }
        public string? User { get; set; }
        public string? Note { get; set; }
    }
}
