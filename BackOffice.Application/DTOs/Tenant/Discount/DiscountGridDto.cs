namespace BackOffice.Application.DTOs.Tenant.Discount
{
    /// <summary>
    /// DTO for Discount grid display
    /// </summary>
    public class DiscountGridDto
    {
        public Guid DiscountID { get; set; }
        public string? Name { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? PercentsDiscount { get; set; }
        public decimal? AmountDiscount { get; set; }
        public int? DiscountType { get; set; }
        public string? DiscountTypeName { get; set; }
        public string? UPCDiscount { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }

    /// <summary>
    /// DTO for full Discount details (view/edit form) — includes all entity fields + related selections
    /// </summary>
    public class DiscountDetailDto
    {
        public Guid DiscountID { get; set; }
        public string? Name { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? PercentsDiscount { get; set; }
        public decimal? AmountDiscount { get; set; }
        public decimal? MinTotalSale { get; set; }
        public string? UPCDiscount { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public bool? ClearBalance { get; set; }
        public int? ClearDays { get; set; }
        public bool? ReqPaswrd { get; set; }
        public decimal? DiscountForCC { get; set; }
        public bool? DiscountItems { get; set; }
        public decimal? PercentsDiscountWithCC { get; set; }
        public bool? SalesItem { get; set; }
        public decimal? MinTotalSale2 { get; set; }
        public decimal? PercentsDiscount2 { get; set; }
        public decimal? AmountDiscount2 { get; set; }
        public decimal? MinTotalSale3 { get; set; }
        public decimal? PercentsDiscount3 { get; set; }
        public decimal? AmountDiscount3 { get; set; }
        public int? DiscountType { get; set; }
        public bool? IncludeGiftCard { get; set; }
        public int? DiscountItem { get; set; }
        public int? DiscountDepartment { get; set; }
        public int? DiscountBrand { get; set; }
        public int? DiscountStore { get; set; }
        public int? BogoQty { get; set; }
        public decimal? BogoAmount { get; set; }
        public int? BogoType { get; set; }
        public bool? SelectedItem { get; set; }
        public decimal? MaxAmount { get; set; }
        public bool? AutoAssign { get; set; }

        // Related selections (loaded from junction tables)
        public List<Guid> SelectedItemIds { get; set; } = new();
        public List<Guid> SelectedDepartmentIds { get; set; } = new();
        public List<Guid> SelectedBrandIds { get; set; } = new();
        public List<Guid> SelectedStoreIds { get; set; } = new();
        // Tenders are int-keyed (Tender.TenderID), unlike the Guid-keyed selections above.
        public List<int> SelectedTenderIds { get; set; } = new();
    }

    /// <summary>
    /// DTO for creating a new Discount
    /// </summary>
    public class CreateDiscountDto
    {
        public string Name { get; set; } = string.Empty;
        public string? UPCDiscount { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public bool? ReqPaswrd { get; set; }
        public bool? SalesItem { get; set; }
        public bool? DiscountItems { get; set; }
        public bool? IncludeGiftCard { get; set; }
        public bool? SelectedItem { get; set; }
        public bool? AutoAssign { get; set; }
        public int? ClearDays { get; set; }
        public decimal? MaxAmount { get; set; }
        // Tier 1
        public decimal? MinTotalSale { get; set; }
        public decimal? AmountDiscount { get; set; }
        public decimal? PercentsDiscount { get; set; }
        // Tier 2
        public decimal? MinTotalSale2 { get; set; }
        public decimal? AmountDiscount2 { get; set; }
        public decimal? PercentsDiscount2 { get; set; }
        // Tier 3
        public decimal? MinTotalSale3 { get; set; }
        public decimal? AmountDiscount3 { get; set; }
        public decimal? PercentsDiscount3 { get; set; }
        // Filter scopes (0=All, 1=Include, 2=Exclude)
        public int? DiscountItem { get; set; }
        public int? DiscountDepartment { get; set; }
        public int? DiscountBrand { get; set; }
        public int? DiscountStore { get; set; }
        public int? DiscountType { get; set; }
        // Related selections
        public List<Guid>? SelectedItemIds { get; set; }
        public List<Guid>? SelectedDepartmentIds { get; set; }
        public List<Guid>? SelectedBrandIds { get; set; }
        public List<Guid>? SelectedStoreIds { get; set; }
        // Tenders are int-keyed (Tender.TenderID), unlike the Guid-keyed selections above.
        public List<int>? SelectedTenderIds { get; set; }
    }

    /// <summary>
    /// DTO for updating a Discount
    /// </summary>
    public class UpdateDiscountDto : CreateDiscountDto
    {
        public Guid DiscountID { get; set; }
    }
}
