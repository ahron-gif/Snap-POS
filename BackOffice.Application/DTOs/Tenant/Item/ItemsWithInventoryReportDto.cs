using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Item
{
    /// <summary>
    /// DTO for store inventory data (used in pivot columns)
    /// </summary>
    public class StoreInventoryDto
    {
        public Guid StoreID { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public int StoreInt { get; set; }
        public decimal? Cost { get; set; }
        public decimal? Price { get; set; }
        public decimal? OnHand { get; set; }
        public decimal? OnOrder { get; set; }
        public decimal? OnTransfer { get; set; }
    }

    /// <summary>
    /// DTO for a single item with inventory across stores
    /// </summary>
    public class ItemWithInventoryDto
    {
        public Guid ItemNo { get; set; }
        public Guid ItemStoreID { get; set; }
        public string BarcodeNumber { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string ModalNumber { get; set; } = string.Empty;

        /// <summary>
        /// Dictionary of store data keyed by StoreName for easy frontend access
        /// </summary>
        public Dictionary<string, StoreInventoryDto> StoreData { get; set; } = new();
    }

    /// <summary>
    /// DTO for store column information (used for dynamic column headers)
    /// </summary>
    public class StoreColumnDto
    {
        public Guid StoreID { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public int StoreInt { get; set; }
    }

    /// <summary>
    /// Request DTO for Items with Inventory report with pagination
    /// </summary>
    public class ItemsWithInventoryRequestDto
    {
        public Guid? StoreId { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 100;
        public string? SearchText { get; set; }
    }

    /// <summary>
    /// Response DTO for Items with Inventory report
    /// Contains both the stores (for dynamic columns) and items with inventory data
    /// </summary>
    public class ItemsWithInventoryReportDto
    {
        /// <summary>
        /// List of stores for generating dynamic column headers
        /// </summary>
        public List<StoreColumnDto> Stores { get; set; } = new();

        /// <summary>
        /// List of items with inventory data across all stores
        /// </summary>
        public List<ItemWithInventoryDto> Items { get; set; } = new();

        /// <summary>
        /// Total number of items (before pagination)
        /// </summary>
        public int TotalCount { get; set; }

        /// <summary>
        /// Current page number
        /// </summary>
        public int PageNumber { get; set; }

        /// <summary>
        /// Page size
        /// </summary>
        public int PageSize { get; set; }

        /// <summary>
        /// Total pages
        /// </summary>
        public int TotalPages { get; set; }
    }
}
