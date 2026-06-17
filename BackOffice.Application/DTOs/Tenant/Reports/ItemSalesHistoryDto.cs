using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// DTO for a single item sales history row.
    /// Based on VB.NET Sales History on Item dialog columns.
    /// </summary>
    public class ItemSalesHistoryDto
    {
        public string? TransactionNo { get; set; }
        public DateTime? Date { get; set; }
        public DateTime? SaleTime { get; set; }
        public decimal? QtyCaseQty { get; set; }
        public decimal? Price { get; set; }
        public decimal? Qty { get; set; }
        public decimal? Total { get; set; }
        public string? StoreName { get; set; }
        public string? CustomerNo { get; set; }
        public string? Type { get; set; }
        public string? CustomerName { get; set; }
        public decimal? Qty2 { get; set; }
    }

    /// <summary>
    /// Request DTO for item-level sales history.
    /// </summary>
    public class ItemSalesHistoryRequestDto
    {
        public Guid ItemStoreID { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        /// <summary>Optional 1-based page number. When null/0 pagination is skipped (backward compatible).</summary>
        public int? PageNumber { get; set; }
        /// <summary>Optional page size. When null/0 pagination is skipped (backward compatible).</summary>
        public int? PageSize { get; set; }
    }

    /// <summary>
    /// Response DTO for item-level sales history.
    /// </summary>
    public class ItemSalesHistoryResponseDto
    {
        public List<ItemSalesHistoryDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalAmount { get; set; }
    }

    /// <summary>
    /// DTO for a date scope preset (from DateScope table).
    /// </summary>
    public class DateScopeDto
    {
        public int ScopeID { get; set; }
        public string Description { get; set; } = string.Empty;
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int? SortOrder { get; set; }
    }
}
