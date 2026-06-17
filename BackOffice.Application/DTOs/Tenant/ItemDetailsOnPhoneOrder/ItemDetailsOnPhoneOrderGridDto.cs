namespace BackOffice.Application.DTOs.Tenant.ItemDetailsOnPhoneOrder
{
    /// <summary>
    /// DTO for Item Details on Phone Order report grid.
    /// Maps from Rpt_ItemDetailsOnPhoneOrderResult stored procedure result.
    /// </summary>
    public class ItemDetailsOnPhoneOrderGridDto
    {
        public decimal? Qty { get; set; }
        public string? Name { get; set; }
        public string? ModalNumber { get; set; }
        public string? BarcodeNumber { get; set; }
        public decimal? Cost { get; set; }
        public decimal? Price { get; set; }
        public decimal? OnHand { get; set; }
        public Guid ItemStoreID { get; set; }
        public string? Note { get; set; }
        public string? PhoneOrderNo { get; set; }
        public string? CustomerNo { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string PickedBy { get; set; } = string.Empty;
        public decimal PickQty { get; set; }
        public string? Groups { get; set; }
        public string? PickNote { get; set; }
        public string? PhoneOrderType { get; set; }
        public DateTime? DeliveryDate { get; set; }
        public DateTime? DateCreated { get; set; }
    }
}
