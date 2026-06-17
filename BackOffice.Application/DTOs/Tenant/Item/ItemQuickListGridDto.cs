namespace BackOffice.Application.DTOs.Tenant.Item
{
    public class ItemQuickListGridDto
    {
        public Guid ItemStoreID { get; set; }
        public Guid ItemID { get; set; }
        public string? Department { get; set; }
        public string? Name { get; set; }
        public string? ModelNo { get; set; }
        public string? UPC { get; set; }
        public string? Supplier { get; set; }
        public Guid StoreNo { get; set; }
        public decimal Price { get; set; }
        public decimal? OnHand { get; set; }
    }
}
