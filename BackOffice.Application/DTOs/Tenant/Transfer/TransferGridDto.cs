namespace BackOffice.Application.DTOs.Tenant.Transfer
{
    public class TransferGridDto
    {
        public Guid TransferID { get; set; }
        public string? TransferNo { get; set; }
        public DateTime? TransferDate { get; set; }
        public decimal? TotalCost { get; set; }
        public string? TransferStatusDec { get; set; }
        public string? Note { get; set; }
        public string? To_Store { get; set; }
        public string? From_Store { get; set; }
        public string? UserName { get; set; }
        public short? Status { get; set; }
        public int? TransferStatus { get; set; }
        public Guid? FromStoreID { get; set; }
        public Guid? ToStoreID { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }
}
