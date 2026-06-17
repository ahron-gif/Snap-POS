namespace BackOffice.Application.DTOs.Tenant.Transaction
{
    public class TransactionGridDto
    {
        public Guid TransactionID { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        public int TransactionType { get; set; }
        public string TransactionTypeName { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerNo { get; set; }
        public decimal? Debit { get; set; }
        public decimal? Credit { get; set; }
        public decimal? Amount { get; set; }
        public decimal? AppliedAmount { get; set; }
        public decimal? Balance { get; set; }
        public decimal? SubTotal { get; set; }
        public decimal? Tax { get; set; }
        public decimal? Freight { get; set; }
        public DateTime? StartSaleTime { get; set; }
        public string? StartTime { get; set; }
        public DateTime? EndSaleTime { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? DeliveryDate { get; set; }
        public string? TrackNo { get; set; }
        public short? Status { get; set; }
        public string? VoidReason { get; set; }
        public string? StoreName { get; set; }
        public string? User { get; set; }
        public string? SaleAssociate { get; set; }
        public string? Note { get; set; }
        public string ResellerName { get; set; } = string.Empty;
        public string? PONo { get; set; }
        public bool? RegisterTransaction { get; set; }
        public bool? PhoneOrder { get; set; }
        public Guid? BatchID { get; set; }
        public Guid? StoreID { get; set; }
        public Guid? CustomerID { get; set; }
    }
}
