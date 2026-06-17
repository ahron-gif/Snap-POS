namespace BackOffice.Application.DTOs.Tenant.Computer
{
    public class ComputerGridDto
    {
        public Guid ComputerID { get; set; }
        public string? ComputerName { get; set; }
        public string? ComputerNo { get; set; }
        public Guid? StoreID { get; set; }
        public string? LabelPrinter { get; set; }
        public string? ShelfPrinter { get; set; }
        public string? InvoicePrinter { get; set; }
        public string? StatementPrinter { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public Guid? UserCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public Guid? UserModified { get; set; }
    }
}
