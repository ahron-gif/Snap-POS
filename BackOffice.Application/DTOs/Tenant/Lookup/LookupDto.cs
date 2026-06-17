namespace BackOffice.Application.DTOs.Tenant.Lookup
{
    /// <summary>
    /// Generic lookup DTO for system dropdowns
    /// </summary>
    public class LookupDto
    {
        public int Value { get; set; }
        public string Label { get; set; } = string.Empty;
        public int? SortOrder { get; set; }
    }

    /// <summary>
    /// DTO for Item Type lookup
    /// </summary>
    public class ItemTypeLookupDto : LookupDto { }

    /// <summary>
    /// DTO for Barcode Type lookup
    /// </summary>
    public class BarcodeTypeLookupDto : LookupDto { }

    /// <summary>
    /// DTO for UOM (Unit of Measure) Type lookup
    /// </summary>
    public class UOMTypeLookupDto : LookupDto { }

    /// <summary>
    /// DTO for Measure lookup
    /// </summary>
    public class MeasureLookupDto : LookupDto { }

    /// <summary>
    /// DTO for Adjust Type lookup (Inventory Count, Theft, Damaged, etc.)
    /// </summary>
    public class AdjustTypeLookupDto : LookupDto { }

    /// <summary>
    /// DTO for Department lookup with hierarchy support (tree structure)
    /// </summary>
    public class DepartmentLookupDto
    {
        public Guid DepartmentStoreID { get; set; }
        public string Name { get; set; } = string.Empty;
        public Guid? ParentDepartmentID { get; set; }
    }

    /// <summary>
    /// DTO for Items Lookup Values (Manufacturer, Pattern, Custom Fields, etc.)
    /// ValueType: 0=Pattern, 1-10=CustomField1-10, 11=Manufacturer
    /// </summary>
    public class ItemsLookupValueDto
    {
        public Guid ValueID { get; set; }
        public string ValueName { get; set; } = string.Empty;
        public short ValueType { get; set; }
    }

    /// <summary>
    /// DTO for Extra Charge Item lookup (from SP_GetExtraChargeItems)
    /// Used to populate Extra Charge 1, 2, 3 dropdowns in Item form
    /// </summary>
    public class ExtraChargeItemLookupDto
    {
        public Guid ItemStoreID { get; set; }
        public string Name { get; set; } = string.Empty;
        public string BarcodeNumber { get; set; } = string.Empty;
        public decimal Price { get; set; }
    }

    /// <summary>
    /// DTO for Store lookup (from SP_GetStoresByUser)
    /// Used to populate Store dropdown in Item form header
    /// </summary>
    public class StoreLookupDto
    {
        public Guid StoreID { get; set; }
        public string StoreName { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for App Item lookup (from SP_GetAppItems)
    /// Used to populate App Button dropdown in Item form Extra tab
    /// </summary>
    public class AppItemLookupDto
    {
        public int Id { get; set; }
        public string AppName { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for Tax lookup (Tax table: TaxID, TaxName)
    /// Used to populate Tax dropdown next to Taxable checkbox in Item form
    /// </summary>
    public class TaxLookupDto
    {
        public Guid TaxID { get; set; }
        public string TaxName { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for Phone Note lookup (Shift presets, Driver Notes, etc.)
    /// Type: 0=Shift, other types for different note categories
    /// </summary>
    public class PhoneNoteLookupDto
    {
        public int PhoneNoteIDVal { get; set; }
        public string Value { get; set; } = string.Empty;
        public short? Type { get; set; }
        public short? Sort { get; set; }
    }

    /// <summary>
    /// DTO for Zone lookup (CCRT values from CustomerAddresses)
    /// Used for Zones dropdown in Phone Order form
    /// </summary>
    public class ZoneLookupDto
    {
        public string Zone { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for Tender lookup (for Phone Order form)
    /// Query: SELECT * FROM Tender WHERE ShowOnPhoneOrder = 1 AND Status > -1
    /// </summary>
    public class TenderLookupDto
    {
        public int TenderID { get; set; }
        public string TenderName { get; set; } = string.Empty;
        public short? SortOrder { get; set; }
    }

    /// <summary>
    /// DTO for creating/updating a Phone Note (Shift preset, Driver Note, Pick Note)
    /// </summary>
    public class PhoneNoteCreateUpdateDto
    {
        public int? PhoneNoteIDVal { get; set; }
        public string Value { get; set; } = string.Empty;
        public short Type { get; set; }
        public short? Sort { get; set; }
    }

    /// <summary>
    /// DTO for batch saving phone notes (replaces all notes of a given type)
    /// </summary>
    public class PhoneNoteBatchSaveDto
    {
        public short Type { get; set; }
        public List<PhoneNoteCreateUpdateDto> Notes { get; set; } = new();
    }

    /// <summary>
    /// DTO for User lookup (for Pick By dropdown in Phone Order form)
    /// Query: SELECT * FROM UsersView WHERE Status > -1 AND (StoreID = @storeId OR IsSuperAdmin = 1 OR IsDefault = 0)
    /// </summary>
    public class UserLookupDto
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for Mix & Match lookup (from SP_MixAndMatch)
    /// Used to populate Mix & Match dropdown in Item form Specials tab
    /// </summary>
    public class MixAndMatchLookupDto
    {
        public Guid MixAndMatchID { get; set; }
        public string Name { get; set; } = string.Empty;
        public int? Qty { get; set; }
        public decimal? Amount { get; set; }
        public bool? AssignDate { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? MinTotalSale { get; set; }
    }

    /// <summary>
    /// DTO for creating a new Mix & Match configuration
    /// </summary>
    public class CreateMixAndMatchDto
    {
        public string Name { get; set; } = string.Empty;
        public int? Qty { get; set; }
        public decimal? Amount { get; set; }
        public bool? AssignDate { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? MinTotalSale { get; set; }
    }

    public class GroupLookupDto
    {
        public Guid GroupID { get; set; }
        public string GroupName { get; set; } = string.Empty;
    }
    /// <summary>
    /// DTO for creating a new Items Lookup Value (Pattern, Custom Fields)
    /// ValueType: 0=Pattern, 1-10=CustomField1-10
    /// </summary>
    public class CreateItemsLookupValueDto
    {
        public string ValueName { get; set; } = string.Empty;
        public short ValueType { get; set; }
    }

    // ─── Advanced Filters modal lookups ────────────────────────────────────
    // These power the multi-tab Filters dialog on report pages
    // (Item / Supplier / Customer / More). Kept as a small flat shape so
    // SearchableSelect on the frontend can render {value, label} pairs.

    /// <summary>Customer Type — int value backed by the legacy CustomerType
    /// enum on Customer.CustomerType. Static lookup, no DB table.</summary>
    public class CustomerTypeLookupDto
    {
        public int Value { get; set; }
        public string Label { get; set; } = string.Empty;
    }

    /// <summary>Price Level — derived from the PriceLevel table joined by
    /// PriceLevelID (legacy int FK on Customer despite the table's Guid PK).</summary>
    public class PriceLevelLookupDto
    {
        public int Value { get; set; }
        public string Label { get; set; } = string.Empty;
    }

    /// <summary>Distinct zip codes from Customer.CreditZip + CustomerAddress.Zip.
    /// Used to filter reports by customer geography.</summary>
    public class ZipLookupDto
    {
        public string Zip { get; set; } = string.Empty;
    }

    /// <summary>Discount lookup — small subset of the Discount entity used
    /// for dropdowns. Active discounts only.</summary>
    public class DiscountLookupDto
    {
        public Guid DiscountID { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    /// <summary>Distinct brand strings from ItemMain.Brand. Brand isn't a
    /// table in this schema — it's a free-text column — so the lookup
    /// returns the distinct values that are actually in use.</summary>
    public class BrandLookupDto
    {
        public string Brand { get; set; } = string.Empty;
    }

    /// <summary>Lightweight item lookup for autocomplete-style search in
    /// the Filters modal. Returns ItemID + a display label combining name
    /// and barcode so the user can locate items quickly.</summary>
    public class ItemFilterLookupDto
    {
        public Guid ItemID { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Barcode { get; set; }
        public string? ModelNo { get; set; }
        public string? Department { get; set; }
    }
}
