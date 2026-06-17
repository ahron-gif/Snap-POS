namespace BackOffice.Application.DTOs.Tenant.Supplier
{
    public class SupplierItemDto
    {
        public Guid ItemID { get; set; }
        public string? Name { get; set; }
        public string? UPC { get; set; }
        public decimal Cost { get; set; }
        public int? MinQty { get; set; }
        public bool MainSupplier { get; set; }
        public short? Status { get; set; }
    }
}
