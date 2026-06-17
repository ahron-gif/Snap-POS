using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// DTO for Price Change History Report - one row per price change
    /// Based on SP_GetPriceChange (Filter + ItemFilter)
    /// </summary>
    public class PriceChangeHistoryDto
    {
        public Guid? ItemStoreID { get; set; }
        public Guid ItemID { get; set; }
        public string PriceLevel { get; set; } = string.Empty;
        public decimal? OldPrice { get; set; }
        public decimal? NewPrice { get; set; }
        public DateTime? ChangeDate { get; set; }
        public string SaleDate { get; set; } = string.Empty;
        public string SaleType { get; set; } = string.Empty;
        public string SP_Price { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string ModalNumber { get; set; } = string.Empty;
        public string BarcodeNumber { get; set; } = string.Empty;
        public string Brand { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request DTO for Price Change History Report with pagination and filters.
    /// Aligned with VB GetChangePrice: Filter = date ([Date]) + StoreNo + UserID + DepartmentID; ItemFilter = no-op when no items.
    /// StoreId from PaginationGridDto; optional DepartmentIds/UserIds for SP_GetPriceChange Filter.
    /// </summary>
    public class PriceChangeHistoryRequestDto : PaginationGridDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        /// <summary>Optional department filter; when set, appended as DepartmentID IN (...) to Filter (matches VB BuildDepartmentFilter).</summary>
        public List<Guid>? DepartmentIds { get; set; }
        /// <summary>When true and DepartmentIds set, include sub-departments via SP_GetSubDepartments (matches VB IncludeSubDeparment).</summary>
        public bool IncludeSubDepartments { get; set; }
        /// <summary>Optional user filter; when set, appended as UserID IN (...) to Filter (matches VB GetFilterArray User).</summary>
        public List<Guid>? UserIds { get; set; }
        /// <summary>Optional item-level filter; when set, filters results to this specific ItemStoreID.</summary>
        public Guid? ItemStoreID { get; set; }
        /// <summary>Optional 1-based page number for SP-level pagination. When null/0 pagination is skipped (backward compatible).</summary>
        public int? PageNumber { get; set; }
        /// <summary>Optional page size for SP-level pagination. When null/0 pagination is skipped (backward compatible).</summary>
        public int? PageSize { get; set; }
    }

    /// <summary>
    /// Response DTO for Price Change History Report
    /// </summary>
    public class PriceChangeHistoryResponseDto
    {
        public System.Collections.Generic.List<PriceChangeHistoryDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}
