using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Lookup
{
    /// <summary>
    /// Filter for the discount "Import Items" dialog (mirrors the desktop
    /// ImportItem form's Fill). All filters are optional and combined with AND,
    /// matching the legacy SQL (Department / Brand / Supplier / Group / Item Type).
    /// </summary>
    public class DiscountImportItemsRequestDto
    {
        /// <summary>Store whose item rows to read (one row per item). Optional — when
        /// omitted, items are returned distinct across stores.</summary>
        public Guid? StoreId { get; set; }
        public List<Guid>? DepartmentIds { get; set; }
        public List<Guid>? ManufacturerIds { get; set; }
        public List<Guid>? SupplierIds { get; set; }
        public List<Guid>? GroupIds { get; set; }
        public List<int>? ItemTypes { get; set; }
        /// <summary>Optional free-text match on name / barcode / model.</summary>
        public string? Search { get; set; }
        /// <summary>Safety cap on rows returned (default 2000).</summary>
        public int? MaxRows { get; set; }
    }

    /// <summary>One candidate row in the Import Items grid.</summary>
    public class DiscountImportItemDto
    {
        public Guid ItemId { get; set; }
        public Guid ItemStoreId { get; set; }
        public string? Barcode { get; set; }
        public string? Name { get; set; }
        public string? ModelNo { get; set; }
        public string? ItemType { get; set; }
        public decimal Price { get; set; }
        public string? Size { get; set; }
        public string? Brand { get; set; }
        public string? Department { get; set; }
    }
}
