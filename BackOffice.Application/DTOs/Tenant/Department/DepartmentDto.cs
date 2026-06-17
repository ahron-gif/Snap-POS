namespace BackOffice.Application.DTOs.Tenant.Department
{
    /// <summary>
    /// DTO for Department grid display (tree view)
    /// </summary>
    public class DepartmentGridDto
    {
        public Guid DepartmentStoreID { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Guid? ParentDepartmentID { get; set; }
        public decimal? DefaultMarkup { get; set; }
        public int RoundUp { get; set; }
        public bool? IsDefaultTaxInclude { get; set; }
        public bool? IsDefaultFoodStampable { get; set; }
        public bool? IsDefaultDiscountable { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }

    /// <summary>
    /// DTO for creating a new Department
    /// </summary>
    public class CreateDepartmentDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Guid? ParentDepartmentID { get; set; }
        public decimal? DefaultMarkup { get; set; }
        public decimal? DefaultMarkupA { get; set; }
        public decimal? DefaultMarkupB { get; set; }
        public decimal? DefaultMarkupC { get; set; }
        public decimal? DefaultMarkupD { get; set; }
        public int? RoundUp { get; set; }
        public int? RoundUpA { get; set; }
        public int? RoundUpB { get; set; }
        public int? RoundUpC { get; set; }
        public int? RoundUpD { get; set; }
        public decimal? RoundValue { get; set; }
        public decimal? RoundValueA { get; set; }
        public decimal? RoundValueB { get; set; }
        public decimal? RoundValueC { get; set; }
        public decimal? RoundValueD { get; set; }
        public int? DefaultCogsAccount { get; set; }
        public int? DefaultIncomeAccount { get; set; }
        public Guid? DefaultTaxNo { get; set; }
        public bool? IsDefaultTaxInclude { get; set; }
        public bool? IsDefaultFoodStampable { get; set; }
        public bool? IsDefaultDiscountable { get; set; }
        public int? DefaultProfitCalculation { get; set; }
        public string? DepartmentNo { get; set; }
        public Guid? DiscountID { get; set; }
    }

    /// <summary>
    /// DTO for updating a Department
    /// </summary>
    public class UpdateDepartmentDto : CreateDepartmentDto
    {
        public Guid DepartmentStoreID { get; set; }

        // Optimistic-concurrency token: the DateModified value the client read from GET.
        // SP_DepartmentStoreUpdate's WHERE clause requires this to equal the row's stored
        // DateModified (or be NULL on a never-modified row), otherwise the UPDATE no-ops.
        public DateTime? DateModified { get; set; }
    }

    /// <summary>
    /// DTO for full Department details (view/edit form)
    /// </summary>
    public class DepartmentDetailDto
    {
        public Guid DepartmentStoreID { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Guid? ParentDepartmentID { get; set; }
        public Guid? StoreID { get; set; }
        public decimal? DefaultMarkup { get; set; }
        public decimal? DefaultMarkupA { get; set; }
        public decimal? DefaultMarkupB { get; set; }
        public decimal? DefaultMarkupC { get; set; }
        public decimal? DefaultMarkupD { get; set; }
        public int RoundUp { get; set; }
        public int? RoundUpA { get; set; }
        public int? RoundUpB { get; set; }
        public int? RoundUpC { get; set; }
        public int? RoundUpD { get; set; }
        public decimal? RoundValue { get; set; }
        public decimal? RoundValueA { get; set; }
        public decimal? RoundValueB { get; set; }
        public decimal? RoundValueC { get; set; }
        public decimal? RoundValueD { get; set; }
        public int? DefaultCogsAccount { get; set; }
        public int? DefaultIncomeAccount { get; set; }
        public Guid? DefaultTaxNo { get; set; }
        public bool? IsDefaultTaxInclude { get; set; }
        public bool? IsDefaultFoodStampable { get; set; }
        public bool? IsDefaultDiscountable { get; set; }
        public int? DefaultProfitCalculation { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public int? KeyNumber { get; set; }
        public string? DepartmentNo { get; set; }
        public Guid? DiscountID { get; set; }
    }
}
