namespace BackOffice.Application.DTOs.Tenant.ReceiveTransfer
{
    public class ReceiveTransferGridDto
    {
        public Guid ReceiveTransferID { get; set; }
        public DateTime? ReceiveDate { get; set; }
        public Guid? TransferID { get; set; }
        public string? TransferNo { get; set; }
        public string? ReciveNo { get; set; }
        public int? TransferStatus { get; set; }
        public DateTime? TransferDate { get; set; }
        public string? Note { get; set; }
        public string? TransferUser { get; set; }
        public string? ReceiveUser { get; set; }
        public string? StoreReceived { get; set; }
        public string? FromStore { get; set; }
        public string? ToStore { get; set; }
        public int? Status { get; set; }
        public Guid? FromStoreid { get; set; }
        public Guid? ToStoreID { get; set; }
        public Guid? StoreID { get; set; }
    }
}
