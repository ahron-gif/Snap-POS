using System;
using BackOffice.Application.DTOs;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// DTO for Tax Collected Report
    /// Based on VB.NET RepTaxCollected form - displays tax collected per transaction
    /// </summary>
    public class TaxCollectedDto
    {
        /// <summary>
        /// Transaction Number
        /// </summary>
        public string TransactionNo { get; set; } = string.Empty;

        /// <summary>
        /// Transaction ID (for double-click navigation)
        /// </summary>
        public Guid TransactionID { get; set; }

        /// <summary>
        /// Store Name
        /// </summary>
        public string StoreName { get; set; } = string.Empty;

        /// <summary>
        /// Store ID
        /// </summary>
        public Guid StoreID { get; set; }

        /// <summary>
        /// Transaction Date
        /// </summary>
        public DateTime Date { get; set; }

        /// <summary>
        /// Tax Rate (percentage)
        /// </summary>
        public decimal TaxRate { get; set; }

        /// <summary>
        /// Tax Amount Sum
        /// </summary>
        public decimal TaxSum { get; set; }

        /// <summary>
        /// Customer Number
        /// </summary>
        public string CustomerNo { get; set; } = string.Empty;

        /// <summary>
        /// Customer Name
        /// </summary>
        public string CustomerName { get; set; } = string.Empty;

        /// <summary>
        /// Total Sale Amount
        /// </summary>
        public decimal TotalSale { get; set; }

        /// <summary>
        /// Payment Method Name (e.g., CASH, Credit Card)
        /// </summary>
        public string Payment { get; set; } = string.Empty;

        /// <summary>
        /// Tax Name
        /// </summary>
        public string TaxName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request DTO for Tax Collected Report with pagination and filters
    /// </summary>
    public class TaxCollectedRequestDto : PaginationGridDto
    {
        /// <summary>
        /// From Date filter
        /// </summary>
        public DateTime? FromDate { get; set; }

        /// <summary>
        /// To Date filter
        /// </summary>
        public DateTime? ToDate { get; set; }

        // ── Advanced "Filters" dialog — Customer tab (multi-select) ──────────
        // Built into the SP's @CustomerFilter as `AND <col> IN (...)` against
        // CustomerRepFilter, mirroring the desktop GetCustomerFilter. Named to
        // avoid the base PaginationGridDto.CustomerId (int) collision.

        /// <summary>Selected customer IDs (GUID). → CustomerRepFilter.CustomerID</summary>
        public List<Guid>? FilterCustomerIds { get; set; }

        /// <summary>Selected customer type codes. → CustomerRepFilter.CustomerType</summary>
        public List<int>? CustomerTypes { get; set; }

        /// <summary>Selected customer group IDs (GUID). → CustomerRepFilter.CustomerGroupID</summary>
        public List<Guid>? CustomerGroupIds { get; set; }

        /// <summary>Selected price level numbers. → CustomerRepFilter.PriceLevelID</summary>
        public List<int>? PriceLevels { get; set; }

        /// <summary>Selected zip codes. → CustomerRepFilter.Zip</summary>
        public List<string>? Zips { get; set; }

        /// <summary>Selected discount IDs (GUID). → CustomerRepFilter.DiscountID</summary>
        public List<Guid>? DiscountIds { get; set; }

        /// <summary>Customer-tab "Taxable" checkbox → CustomerRepFilter.TaxExempt=1 (matches desktop).</summary>
        public bool? Taxable { get; set; }
    }

    /// <summary>
    /// Response DTO with summary totals for Tax Collected Report
    /// </summary>
    public class TaxCollectedResponseDto
    {
        /// <summary>
        /// List of tax collected records
        /// </summary>
        public List<TaxCollectedDto> Data { get; set; } = new();

        /// <summary>
        /// Total records count
        /// </summary>
        public int TotalRecords { get; set; }

        /// <summary>
        /// Total Tax Sum across all records
        /// </summary>
        public decimal TotalTaxSum { get; set; }

        /// <summary>
        /// Total Sale across all records
        /// </summary>
        public decimal TotalSale { get; set; }
    }

    // ---------------------------------------------------------------------------
    // Tax By Store Report (SP_GetTaxReprtByStore)
    // ---------------------------------------------------------------------------

    /// <summary>
    /// DTO for Tax By Store Report - one row per store with aggregated tax/sales
    /// Based on SP_GetTaxReprtByStore
    /// </summary>
    public class TaxByStoreDto
    {
        public string StoreName { get; set; } = string.Empty;
        /// <summary>Tax rate as percentage (e.g. 8.25)</summary>
        public decimal TaxRate { get; set; }
        public decimal TotalSales { get; set; }
        public decimal TaxableSales { get; set; }
        public decimal TotalExempt { get; set; }
        public decimal NonTaxableSales { get; set; }
        public decimal Tax { get; set; }
    }

    /// <summary>
    /// Request for Tax By Store report - same shape as Tax Collected (pagination, sort, filters, dates, store)
    /// </summary>
    public class TaxByStoreRequestDto : PaginationGridDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }

        // ── Advanced "Filters" dialog — Customer tab (multi-select) ──────────
        // Same shape as TaxCollectedRequestDto; built into the SP's @CustomerFilter
        // as `AND <col> IN (...)` against CustomerRepFilter. Named to avoid the
        // base PaginationGridDto.CustomerId (int) collision.
        public List<Guid>? FilterCustomerIds { get; set; }
        public List<int>? CustomerTypes { get; set; }
        public List<Guid>? CustomerGroupIds { get; set; }
        public List<int>? PriceLevels { get; set; }
        public List<string>? Zips { get; set; }
        public List<Guid>? DiscountIds { get; set; }
        public bool? Taxable { get; set; }
    }

    /// <summary>
    /// Response for Tax By Store report - Data, TotalRecords, and grand total fields for summary row
    /// </summary>
    public class TaxByStoreResponseDto
    {
        public List<TaxByStoreDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalTaxSum { get; set; }
        public decimal TotalSale { get; set; }
        public decimal TotalTaxableSales { get; set; }
        public decimal TotalExempt { get; set; }
        public decimal TotalNonTaxableSales { get; set; }
    }
}
