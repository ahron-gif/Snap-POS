using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Item
{
    /// <summary>
    /// DTO for creating a new item with all related data (ItemMain, ItemStore, ItemSupply, ItemToGroup, ItemAlias)
    /// Also used for updating existing items when ItemId is provided
    /// </summary>
    public class CreateItemDto
    {
        /// <summary>
        /// Optional: If provided, this is an update operation. Used to exclude this item from barcode uniqueness check.
        /// </summary>
        public Guid? ItemId { get; set; }

        // ItemMain properties
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? ModalNumber { get; set; }
        public string BarcodeNumber { get; set; } = string.Empty;
        public string? CaseBarcodeNumber { get; set; }
        /// <summary>
        /// Short case code (maps to ItemMain.CaseBarCode column, shown as "Case Code" in old VB.NET form)
        /// This is separate from CaseBarcodeNumber which is the full case UPC barcode
        /// </summary>
        public string? CaseCode { get; set; }
        public int? CaseQty { get; set; }
        public string? CaseDescription { get; set; }
        public int? BarcodeType { get; set; }
        public int? ItemType { get; set; }
        public bool? IsTemplate { get; set; }
        public bool? IsSerial { get; set; }
        public Guid? ManufacturerID { get; set; }
        public string? ManufacturerPartNo { get; set; }
        public bool? PriceByCase { get; set; }
        public bool? CostByCase { get; set; }
        public string? Size { get; set; }
        public decimal? Units { get; set; }
        public int? Measure { get; set; }
        public string? ExtraInfo { get; set; }
        public string? ExtraInfo2 { get; set; }
        public string? CustomerCode { get; set; }
        public string? NoScanMsg { get; set; }
        public string? StyleNo { get; set; }
        public int? CustomInteger1 { get; set; }
        public Guid? SeasonID { get; set; }
        public string? Matrix1 { get; set; }
        public string? Matrix2 { get; set; }
        public string? Matrix3 { get; set; }
        public string? Matrix4 { get; set; }
        public string? Matrix5 { get; set; }
        public string? Matrix6 { get; set; }
        public Guid? ParentID { get; set; }
        public Guid? LinkNo { get; set; }
        public string? PkgCode { get; set; }
        public int? AddToApp { get; set; }

        /// <summary>
        /// Pattern lookup value ID (maps to ItemMain.ExtName column)
        /// </summary>
        public Guid? Pattern { get; set; }

        // Custom Field properties (references to lookup values)
        public Guid? CustomField1 { get; set; }
        public Guid? CustomField2 { get; set; }
        public Guid? CustomField3 { get; set; }
        public Guid? CustomField4 { get; set; }
        public Guid? CustomField5 { get; set; }
        public Guid? CustomField6 { get; set; }
        public Guid? CustomField7 { get; set; }
        public Guid? CustomField8 { get; set; }
        public Guid? CustomField9 { get; set; }
        public Guid? CustomField10 { get; set; }

        // ItemStore properties
        public Guid StoreNo { get; set; }
        public Guid? DepartmentID { get; set; }
        public bool? IsDiscount { get; set; }
        public bool? IsTaxable { get; set; }
        public Guid? TaxID { get; set; }
        public bool? IsFoodStampable { get; set; }
        public bool? IsWIC { get; set; }
        public decimal? Cost { get; set; }
        public decimal? ListPrice { get; set; }
        public decimal? Price { get; set; }
        public decimal? PriceA { get; set; }
        public decimal? PriceB { get; set; }
        public decimal? PriceC { get; set; }
        public decimal? PriceD { get; set; }
        public Guid? ExtraCharge1 { get; set; }
        public Guid? ExtraCharge2 { get; set; }
        public Guid? ExtraCharge3 { get; set; }
        public int? CogsAccount { get; set; }
        public int? IncomeAccount { get; set; }
        public int ProfitCalculation { get; set; }
        public decimal? CommissionQty { get; set; }
        public int CommissionType { get; set; }
        public int? PrefSaleBy { get; set; }
        public int? PrefOrderBy { get; set; }
        public decimal? OnHand { get; set; }
        public decimal? OnOrder { get; set; }
        public decimal? OnTransferOrder { get; set; }
        public decimal? ReorderPoint { get; set; }
        public decimal? RestockLevel { get; set; }
        public string? BinLocation { get; set; }
        public int? DaysForReturn { get; set; }

        // Sale properties
        public int? SaleType { get; set; }
        public decimal? SalePrice { get; set; }
        public DateTime? SaleStartDate { get; set; }
        public DateTime? SaleEndDate { get; set; }
        public int? SaleMin { get; set; }
        public int? SaleMax { get; set; }
        public decimal? MinForSale { get; set; }
        public int? SpecialBuy { get; set; }
        public decimal? SpecialPrice { get; set; }
        public DateTime? SpecialBuyFromDate { get; set; }
        public DateTime? SpecialBuyToDate { get; set; }
        public Guid? MixAndMatchID { get; set; }
        public bool? AssignDate { get; set; }
        public decimal? CasePrice { get; set; }
        public decimal? CaseSpecial { get; set; }
        public decimal? PkgPrice { get; set; }
        public int? PkgQty { get; set; }
        public bool? IsCaseDiscount { get; set; }
        public bool? IsPkgDiscount { get; set; }
        public decimal? Tare { get; set; }

        // Future pricing (maps to ItemStore.NewPrice / ItemStore.NewPriceDate)
        public decimal? NewPrice { get; set; }
        public DateTime? NewPriceDate { get; set; }

        public bool? SellOnWeb { get; set; }
        public decimal? WebCasePrice { get; set; }
        public decimal? WebPrice { get; set; }

        // Related data collections
        public List<CreateItemSupplyDto>? ItemSupplies { get; set; }
        public List<CreateItemToGroupDto>? ItemToGroups { get; set; }
        public List<CreateItemAliasDto>? ItemAliases { get; set; }
    }

    /// <summary>
    /// DTO for creating item supplier relationship
    /// </summary>
    public class CreateItemSupplyDto
    {
        public Guid SupplierNo { get; set; }
        public decimal? TotalCost { get; set; }
        public decimal? GrossCost { get; set; }
        public int? MinimumQty { get; set; }
        public int? QtyPerCase { get; set; }
        public bool? IsOrderedOnlyInCase { get; set; }
        public int? AverageDeliveryDelay { get; set; }
        public string? ItemCode { get; set; }
        public bool IsMainSupplier { get; set; }
        public short? SortOrder { get; set; }
        public decimal? CaseQty { get; set; }
        public decimal? SalePrice { get; set; }
        public bool? AssignDate { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public bool? OnSpecialReq { get; set; }
        public int? MinQty { get; set; }
        public int? MaxQty { get; set; }
        public int? UOMType { get; set; }
        public string? ColorName { get; set; }
    }

    /// <summary>
    /// DTO for creating item to group relationship
    /// </summary>
    public class CreateItemToGroupDto
    {
        public Guid ItemGroupID { get; set; }
    }

    /// <summary>
    /// DTO for creating item alias (alternative barcode)
    /// </summary>
    public class CreateItemAliasDto
    {
        public string BarcodeNumber { get; set; } = string.Empty;
    }

    /// <summary>
    /// Response DTO after creating an item
    /// </summary>
    public class CreateItemResponseDto
    {
        public Guid ItemID { get; set; }
        public Guid ItemStoreID { get; set; }
        public string? BarcodeNumber { get; set; }
        public string? Name { get; set; }
        public DateTime DateCreated { get; set; }
    }
}
