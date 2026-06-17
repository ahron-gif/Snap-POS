namespace BackOffice.Application.DTOs.Tenant.ItemOnPhoneOrder
{
    /// <summary>
    /// DTO for non-aggregated Items On Phone Order report.
    /// Maps from Rpt_ItemOnPhoneOrderResult stored procedure result.
    /// </summary>
    public class ItemOnPhoneOrderGridDto
    {
        public decimal? Qty { get; set; }
        public string? Name { get; set; }
        public string? ModalNumber { get; set; }
        public string? BarcodeNumber { get; set; }
        public decimal? Cost { get; set; }
        public decimal Price { get; set; }
        public decimal? OnHand { get; set; }
        public Guid ItemStoreID { get; set; }
        public string? PhoneOrderType { get; set; }
        public Guid StoreNo { get; set; }
        public string? StoreName { get; set; }
    }

    /// <summary>
    /// DTO for aggregated Items On Phone Order report.
    /// Maps from Rpt_ItemOnPhoneOrder_AggregatedResult stored procedure result.
    /// </summary>
    public class ItemOnPhoneOrderAggregatedGridDto
    {
        public decimal? Qty { get; set; }
        public string? Name { get; set; }
        public string? ModalNumber { get; set; }
        public string? BarcodeNumber { get; set; }
        public decimal? Cost { get; set; }
        public decimal Price { get; set; }
        public decimal? OnHand { get; set; }
        public string? PhoneOrderType { get; set; }
    }
}
