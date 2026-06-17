namespace BackOffice.Application.DTOs.Tenant.Lookup
{
    /// <summary>
    /// DTO containing department defaults for auto-setting item fields when department changes.
    /// Maps from DepartmentStore entity fields.
    /// </summary>
    public class DepartmentDefaultsDto
    {
        public Guid DepartmentStoreID { get; set; }
        public string Name { get; set; } = string.Empty;

        /// <summary>Default markup percentage for the department</summary>
        public decimal? DefaultMarkup { get; set; }

        /// <summary>Round-up type: 0=None, 1=Round to .X9, 2=Round to .X5, etc.</summary>
        public int RoundUp { get; set; }

        /// <summary>Round-up value (e.g., 0.09 for rounding to .X9)</summary>
        public decimal? RoundValue { get; set; }

        /// <summary>Default tax ID for the department</summary>
        public Guid? DefaultTaxNo { get; set; }

        /// <summary>Whether items in this department are taxable by default</summary>
        public bool? IsDefaultTaxInclude { get; set; }

        /// <summary>Whether items in this department are food-stampable by default</summary>
        public bool? IsDefaultFoodStampable { get; set; }

        /// <summary>Whether items in this department are discountable by default</summary>
        public bool? IsDefaultDiscountable { get; set; }

        /// <summary>Default COGS account for the department</summary>
        public int? DefaultCogsAccount { get; set; }

        /// <summary>Default income account for the department</summary>
        public int? DefaultIncomeAccount { get; set; }
    }
}
