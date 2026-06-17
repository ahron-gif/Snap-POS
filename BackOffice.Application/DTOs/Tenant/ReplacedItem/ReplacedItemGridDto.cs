namespace BackOffice.Application.DTOs.Tenant.ReplacedItem
{
    /// <summary>
    /// DTO for Replaced Items report grid.
    /// Maps from RPT_ReplacedItemsResult stored procedure result.
    /// </summary>
    public class ReplacedItemGridDto
    {
        public string? PhoneOrderNo { get; set; }
        public string? CustomerNo { get; set; }
        public string? Phone { get; set; }
        public string? Cell { get; set; }
        public string LastName { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public DateTime? PhoneOrderDate { get; set; }
        public DateTime? DeliveryDate { get; set; }
        public string PhoneOrderStatus { get; set; } = string.Empty;
        public decimal OldQty { get; set; }
        public decimal NewQty { get; set; }
        public string UserCollected { get; set; } = string.Empty;
        public string? RemovedItem { get; set; }
        public string? RemovedModelNo { get; set; }
        public string? RemovedUPC { get; set; }
        public string? AddedItem { get; set; }
        public string? AddedModelNo { get; set; }
        public string? AddedUPC { get; set; }
        public string Action { get; set; } = string.Empty;
    }
}
