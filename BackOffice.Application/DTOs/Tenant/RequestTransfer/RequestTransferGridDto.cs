namespace BackOffice.Application.DTOs.Tenant.RequestTransfer
{
    public class RequestTransferGridDto
    {
        public Guid RequestTransferID { get; set; }
        public string? RequestNo { get; set; }
        public string? FromStore { get; set; }
        public string? ToStore { get; set; }
        public string? RequestTransferStatusDec { get; set; }
        public int? Status { get; set; }
        public int RequestStatus { get; set; }
        public string? Note { get; set; }
        public string? UserName { get; set; }
        public DateTime? RequestDate { get; set; }
        public DateTime? DateCreated { get; set; }
        public Guid? FromStoreID { get; set; }
        public Guid? ToStoreID { get; set; }
        public decimal? OpenItems { get; set; }
    }
}
