using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs.Tenant.Item
{
    public partial class ItemMainAndStoreGridDto
    {
        public Guid ItemID { get; set; }

        public string? Name { get; set; }

        public string? ModalNumber { get; set; }

        public Guid? LinkNo { get; set; }

        public string? BarcodeNumber { get; set; }

        public Guid StoreNo { get; set; }

        public bool? IsTaxable { get; set; }

        public bool? IsDiscount { get; set; }

        public bool? IsFoodStampable { get; set; }

        public bool? IsWIC { get; set; }

        public decimal? Cost { get; set; }

        public decimal Price { get; set; }

        public int? CaseQty { get; set; }

        public bool? PriceByCase { get; set; }

        public string? StyleNo { get; set; }

        public bool? CostByCase { get; set; }

        public string? CaseBarcodeNumber { get; set; }

        public decimal OnHand { get; set; }

        public decimal? CsOnHand { get; set; }

        public string? BinLocation { get; set; }

        public short? Status { get; set; }

        public DateTime? DateCreated { get; set; }

        public DateTime ItemStoreDateModified { get; set; }

        public DateTime MainDateModified { get; set; }

        public decimal? Cs_Cost { get; set; }

        public decimal? Pc_Cost { get; set; }

        public short? MainStatus { get; set; }

        public Guid ItemStoreID { get; set; }

        public string? Department { get; set; }

        public string? Matrix1 { get; set; }

        public string? Matrix2 { get; set; }

        public string? Matrix3 { get; set; }

        public string? Matrix4 { get; set; }

        public string? Matrix5 { get; set; }

        public string? Matrix6 { get; set; }

        public string? Supplier_Item_Code { get; set; }

        public string? ManufacturerPartNo { get; set; }

        public string? SP_Price { get; set; }

        public string? SupplierName { get; set; }

        public DateTime? GroupDateModified { get; set; }

        public DateTime? SP_From { get; set; }

        public DateTime? SP_To { get; set; }

        public string? Future_SP_Price { get; set; }

        public DateTime? Future_SP_From { get; set; }

        public DateTime? Future_SP_To { get; set; }

        public decimal? Markup { get; set; }

        public decimal? Margin { get; set; }

        public decimal MTD { get; set; }

        public decimal MTD_Pc_Qty { get; set; }

        public decimal? MTD_Cs_Qty { get; set; }

        public decimal YTD { get; set; }

        public decimal YTD_Pc_Qty { get; set; }

        public decimal? YTD_Cs_Qty { get; set; }

        public decimal PTD { get; set; }

        public decimal PTD_Pc_Qty { get; set; }

        public Guid? MatrixTableNo { get; set; }

        public decimal? PTD_Cs_Qty { get; set; }

        public Guid ItemNo { get; set; }

        public string? Brand { get; set; }

        public int ToReorder { get; set; }

        public string? Size { get; set; }

        public DateTime? DepartmentDateModified { get; set; }

        public int? ItemType { get; set; }

        public Guid? DepartmentID { get; set; }

        public string? ItemTypeName { get; set; }

        public string? BarcodeType { get; set; }

        public decimal OnOrder { get; set; }

        public decimal? AVGCost { get; set; }

        public decimal? RegCost { get; set; }

        public decimal ReorderPoint { get; set; }

        public Guid? MainSupplierID { get; set; }

        public decimal RestockLevel { get; set; }

        public decimal? CasePrice { get; set; }

        public string? CustomerCode { get; set; }

        public decimal? OnTransferOrder { get; set; }

        public string? Groups { get; set; }

        public string? ItemAlias { get; set; }

        public string? ParentCode { get; set; }

        public decimal? RegSPPrice { get; set; }

        public decimal? CaseSPPrice { get; set; }

        public string? RegPkgPrice { get; set; }

        public decimal Reg_SP_Price_Markup { get; set; }

        public decimal Reg_SP_Price_Margin { get; set; }

        public decimal? Pkg_Price_Markup { get; set; }

        public decimal? Pkg_Price_Margin { get; set; }

        public decimal SP_Markup { get; set; }

        public decimal? SP_Margin { get; set; }

        public string? MainDepartment { get; set; }

        public string? SubDepartment { get; set; }

        public string? SubSubDepartment { get; set; }

        public int? CustomInteger1 { get; set; }

        public string PrefOrderBy { get; set; } = null!;

        public string PrefSaleBy { get; set; } = null!;

        public decimal ListPrice { get; set; }

        public decimal? Markdown { get; set; }

        public decimal? ListPriceMarkup { get; set; }

        public string? SeasonName { get; set; }

        public string? CustomField1 { get; set; }

        public string? CustomField2 { get; set; }

        public string? CustomField3 { get; set; }

        public string? CustomField4 { get; set; }

        public string? CustomField5 { get; set; }

        public string? CustomField6 { get; set; }

        public string? CustomField7 { get; set; }

        public string? CustomField8 { get; set; }

        public string? CustomField9 { get; set; }

        public string? CustomField10 { get; set; }

        public string? extName { get; set; }

        public string? CaseCode { get; set; }

        public DateTime? LastReceivedDate { get; set; }

        public decimal? LastReceivedQty { get; set; }

        public string? StoreName { get; set; }

        public string? StoreNumber { get; set; }

        public decimal? WebPrice { get; set; }

        public decimal? WebCasePrice { get; set; }

        public bool? SellOnWeb { get; set; }

        public decimal YTDPcQty1 { get; set; }

        public decimal YTDPcQty2 { get; set; }

        public decimal YTDPcQty3 { get; set; }

        public string? Description { get; set; }

        public bool? IsDisableOnPO { get; set; }

        // Not from view - populated separately from ItemMain table
        public int? AddToApp { get; set; }

        // Not from view - populated separately from ItemMain table
        public string? ExtraInfo { get; set; }
        public string? ExtraInfo2 { get; set; }

        // Not from view - populated separately from ItemStore table
        public Guid? ExtraCharge1 { get; set; }
        public Guid? ExtraCharge2 { get; set; }
        public Guid? ExtraCharge3 { get; set; }

        // Not from view - populated separately from ItemMain table
        public Guid? ManufacturerID { get; set; }
        public string? ManufacturerName { get; set; }
        public decimal? Units { get; set; }
        public int? Meaasure { get; set; }
        /// <summary>
        /// Pattern lookup value ID (from ItemMain.ExtName column)
        /// </summary>
        public Guid? PatternId { get; set; }

        // Not from view - populated separately from ItemStore table
        public int? SaleType { get; set; }
        public decimal? SalePrice { get; set; }
        public DateTime? SaleStartDate { get; set; }
        public DateTime? SaleEndDate { get; set; }
        public int? SaleMin { get; set; }
        public int? SaleMax { get; set; }
        public decimal? MinForSale { get; set; }
        public int? SpecialBuy { get; set; }
        public decimal? SpecialPrice { get; set; }
        public decimal? SpecialCost { get; set; }
        public decimal? Tare { get; set; }
        public Guid? TaxID { get; set; }
        public decimal? PkgPrice { get; set; }
        public int? PkgQty { get; set; }
        public bool? IsCaseDiscount { get; set; }
        public bool? IsPkgDiscount { get; set; }
        public Guid? MixAndMatchID { get; set; }
        public bool? AssignDate { get; set; }
        public decimal? CaseSpecial { get; set; }

        // Round-trip fields the form has no UI for. Populated from ItemStore in
        // GetItemByIdAsync so the frontend can preserve them on save without polluting
        // the audit log.
        public decimal? PriceA { get; set; }
        public decimal? PriceB { get; set; }
        public decimal? PriceC { get; set; }
        public decimal? PriceD { get; set; }
        public int? CogsAccount { get; set; }
        public int? IncomeAccount { get; set; }
        public DateTime? SpecialBuyFromDate { get; set; }
        public DateTime? SpecialBuyToDate { get; set; }
        public decimal? CommissionQty { get; set; }
        public int? ProfitCalculation { get; set; }
        public int? CommissionType { get; set; }

        // Not from view - populated separately for Pricing "last modified" display
        public DateTime? LastPriceChange { get; set; }
        public string? LastModifiedByUser { get; set; }

        // Related collections - populated separately
        public List<ItemSupplyDto>? ItemSupplies { get; set; }
        public List<ItemToGroupDto>? ItemToGroups { get; set; }
    }

    public class ItemSupplyDto
    {
        public Guid? SupplierNo { get; set; }
        public string? SupplierName { get; set; }
        public decimal? TotalCost { get; set; }
        public decimal? GrossCost { get; set; }
        public int? QtyPerCase { get; set; }
        public bool? IsMainSupplier { get; set; }
        public string? ItemCode { get; set; }
        public int? AverageDeliveryDelay { get; set; }
    }

    public class ItemToGroupDto
    {
        public Guid? ItemGroupID { get; set; }
    }
}
