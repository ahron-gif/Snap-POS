using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One item row for Sales Summary By Item report (SP_GetItemSummary result set).
    /// </summary>
    public class SalesSummaryByItemRowDto
    {
        public Guid? ItemStoreID { get; set; }
        public string? Name { get; set; }
        public string? Groups { get; set; }
        public string? ParentName { get; set; }
        public string? Color { get; set; }
        public string? Size { get; set; }
        public string? MainSize { get; set; }
        public string? ModalNumber { get; set; }
        public string? BarcodeNumber { get; set; }
        public string? ItemTypeName { get; set; }
        public string? Department { get; set; }
        public Guid? DepartmentID { get; set; }
        public string? MainDepartment { get; set; }
        public string? SubDepartment { get; set; }
        public string? SubSubDepartment { get; set; }
        public string? StyleNo { get; set; }
        public string? Supplier { get; set; }
        public string? ItemCodeSupplier { get; set; }
        public string? Brand { get; set; }
        public string? CustomerCode { get; set; }
        public decimal? Qty { get; set; }
        public decimal? QtyCase { get; set; }
        public decimal? ExtCost { get; set; }
        public decimal? ExtPrice { get; set; }

        [JsonProperty("Discount %")]
        public decimal? DiscountPct { get; set; }

        public decimal? MarginPrice { get; set; }
        public decimal? MarkupPrice { get; set; }
        public decimal? Profit { get; set; }
        public decimal? Discount { get; set; }
        public decimal? TotalAfterDiscount { get; set; }
        public string? StoreName { get; set; }
        public Guid? StoreID { get; set; }
        public Guid? ItemID { get; set; }
        public string? ParentCode { get; set; }
        public decimal? Price { get; set; }
        public decimal? OnHand { get; set; }
        public decimal? OnOrder { get; set; }
        public decimal? SellThru { get; set; }
        public DateTime? LastReceivedDate { get; set; }
        public decimal? LastReceivedQty { get; set; }
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
    }

    /// <summary>
    /// Request for Sales Summary By Item report (desktop clone).
    /// </summary>
    public class SalesSummaryByItemRequestDto : PaginationGridDto
    {
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        [JsonProperty("fromTime")]
        public string? FromTime { get; set; }

        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        [JsonProperty("toTime")]
        public string? ToTime { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }

        /// <summary>
        /// Optional Department filter — set when this report is opened by drilling down from
        /// Sales Summary By Department. Mirrors the desktop's
        /// `BuildDepartmentFilter(Department, "DepartmentID", IncludeSubDepartment)` which
        /// constrains the ItemsRepFilter `#ItemSelect` temp table to a single department.
        /// </summary>
        [JsonProperty("departmentId")]
        public Guid? DepartmentId { get; set; }
    }

    /// <summary>
    /// Response for Sales Summary By Item report.
    /// `OptionCaptions` mirrors the desktop's `DBSetUp.Gate.GetOptionValue(...)` reads at
    /// form load (CustomField1..10, PartNumberCaption, ManufacturerCaption, StyleNoCaption)
    /// so the frontend can rename columns dynamically per tenant. `IsApparel` mirrors the
    /// desktop's `EncDateRow.StoreType = Apparel` check (we use STR_Fashion as a proxy
    /// because the EncData blob is encrypted on the web side); when false the frontend
    /// hides CustomFieldN columns whose caption is still the placeholder + always hides
    /// ParentCode / ParentName / Color.
    /// Populated only on the first page (StartRow == 0) — subsequent pages return empty
    /// dictionary and false, and the UI keeps the page-1 values cached.
    /// </summary>
    public class SalesSummaryByItemResponseDto
    {
        public List<SalesSummaryByItemRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public Dictionary<string, string> OptionCaptions { get; set; } = new();
        public bool IsApparel { get; set; }
    }

    /// <summary>
    /// Request for the Sales Summary By Item drill-down. The parent grid passes the row's
    /// ItemStoreID; backend calls SP_GetTransactionEntryItem(@ItemStoreID) and returns
    /// each transaction line that sold this item.
    /// </summary>
    public class SalesSummaryByItemDetailsRequestDto
    {
        [JsonProperty("itemStoreId")]
        public Guid? ItemStoreId { get; set; }
    }

    /// <summary>
    /// One row of the Sales Summary By Item drill-down — matches SP_GetTransactionEntryItem.
    /// </summary>
    public class SalesSummaryByItemDetailsRowDto
    {
        public string TransactionNo { get; set; } = string.Empty;
        public int TransactionType { get; set; }
        public Guid TransactionId { get; set; }
        public DateTime? StartSaleTime { get; set; }
        public Guid? ItemStoreId { get; set; }
        public decimal? Qty { get; set; }
        public decimal? Total { get; set; }
        public decimal? Price { get; set; }
        public short Status { get; set; }
    }

    public class SalesSummaryByItemDetailsResponseDto
    {
        public List<SalesSummaryByItemDetailsRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalQty { get; set; }
        public decimal TotalAmount { get; set; }
    }
}
