namespace BackOffice.Application.DTOs.Tenant.Supplier
{
    public class SupplierHistoryDto
    {
        public decimal OpenPO { get; set; }
        public DateTime? LastReceive { get; set; }
        public decimal OpenBalance { get; set; }
        public decimal MTD { get; set; }
        public decimal PTD { get; set; }
        public decimal YTD { get; set; }
    }
}
