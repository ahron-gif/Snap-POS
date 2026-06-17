namespace BackOffice.Application.DTOs.Tenant.Store
{
    public class StoreGridDto
    {
        public Guid StoreID { get; set; }
        public string? StoreName { get; set; }
        public string? StoreDescription { get; set; }
        public Guid? ParentStore { get; set; }
        public decimal? DefaultMarkup { get; set; }
        public decimal? DefaultMarkupA { get; set; }
        public decimal? DefaultMarkupB { get; set; }
        public decimal? DefaultMarkupC { get; set; }
        public decimal? DefaultMarkupD { get; set; }
        public int? RoundUp { get; set; }
        public decimal? RoundValue { get; set; }
        public int? DefaultCogsAccount { get; set; }
        public int? DefaultIncomeAccount { get; set; }
        public Guid? DefaultTaxNo { get; set; }
        public bool? IsDefaultTaxInclude { get; set; }
        public int? DefaultProfitCalculation { get; set; }
        public string? StoreEmail { get; set; }
        public bool? IsMainStore { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public Guid? UserCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public Guid? UserModified { get; set; }
        public string? Address { get; set; }
        public string? CityStateZip { get; set; }
        public string? Country { get; set; }
        public DateTime? DateClosed { get; set; }
        public DateTime? DateOpened { get; set; }
        public Guid? DistrictID { get; set; }
        public string? Fax { get; set; }
        public string? Phone1 { get; set; }
        public string? Phone2 { get; set; }
        public Guid? RegionID { get; set; }
        public string? StoreNumber { get; set; }
        public int StoreInt { get; set; }
    }
}
