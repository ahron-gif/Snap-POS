using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// Drill-down request for "all transactions of an item within a date window" — used by the
    /// daily / weekly / monthly pivot drill-downs (mirrors desktop RepMothlySalesDetails &
    /// RepWeeklySalesDetails). The desktop opens these from a pivot cell double-click using
    /// the master ItemID + the cell's date window; we keep the same contract.
    /// </summary>
    public class ItemSalesTransactionsRequestDto
    {
        /// <summary>
        /// Master ItemID. Pass null/Guid.Empty for "[MANUAL ITEM]" rows (matched by Name +
        /// DepartmentID instead).
        /// </summary>
        [JsonProperty("itemId")]
        public Guid? ItemId { get; set; }

        /// <summary>For manual-item rows: match TransactionEntryItem.Name = ItemName.</summary>
        [JsonProperty("itemName")]
        public string? ItemName { get; set; }

        /// <summary>For manual-item rows: optional DepartmentID disambiguator.</summary>
        [JsonProperty("departmentId")]
        public Guid? DepartmentId { get; set; }

        /// <summary>Inclusive yyyy-MM-dd start date (typically the first day of the clicked cell's bucket).</summary>
        [JsonProperty("fromDate")]
        public string? FromDate { get; set; }

        /// <summary>Inclusive yyyy-MM-dd end date (typically the last day of the clicked cell's bucket).</summary>
        [JsonProperty("toDate")]
        public string? ToDate { get; set; }

        /// <summary>Optional store filter.</summary>
        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }
    }

    /// <summary>One transaction line for the item-in-date-range drill-down.</summary>
    public class ItemSalesTransactionsRowDto
    {
        public Guid TransactionId { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        public DateTime? SaleDate { get; set; }
        public int TransactionType { get; set; }
        public decimal? Qty { get; set; }
        public decimal? Price { get; set; }
        public decimal? Cost { get; set; }
        public decimal? ExtCost { get; set; }
        public decimal? ExtPrice { get; set; }
        public Guid? StoreId { get; set; }
        public string? StoreName { get; set; }
    }

    public class ItemSalesTransactionsResponseDto
    {
        public List<ItemSalesTransactionsRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalQty { get; set; }
        public decimal TotalExtCost { get; set; }
        public decimal TotalExtPrice { get; set; }
    }
}
