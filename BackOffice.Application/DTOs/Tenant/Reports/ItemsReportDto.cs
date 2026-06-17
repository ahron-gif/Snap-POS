using System;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// DTO for Items Report
    /// Displays comprehensive item information for inventory reporting
    /// </summary>
    public class ItemsReportDto
    {
        /// <summary>
        /// Item Store ID (unique identifier)
        /// </summary>
        public Guid ItemStoreId { get; set; }

        /// <summary>
        /// Item ID
        /// </summary>
        public Guid ItemId { get; set; }

        /// <summary>
        /// Item Number
        /// </summary>
        public string ItemNo { get; set; } = string.Empty;

        /// <summary>
        /// Item Barcode
        /// </summary>
        public string Barcode { get; set; } = string.Empty;

        /// <summary>
        /// Item Description
        /// </summary>
        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Department Name
        /// </summary>
        public string DepartmentName { get; set; } = string.Empty;

        /// <summary>
        /// Department ID
        /// </summary>
        public Guid? DepartmentId { get; set; }

        /// <summary>
        /// Item Group Name
        /// </summary>
        public string ItemGroupName { get; set; } = string.Empty;

        /// <summary>
        /// Item Group ID
        /// </summary>
        public Guid? ItemGroupId { get; set; }

        /// <summary>
        /// Manufacturer Name
        /// </summary>
        public string ManufacturerName { get; set; } = string.Empty;

        /// <summary>
        /// Manufacturer ID
        /// </summary>
        public Guid? ManufacturerId { get; set; }

        /// <summary>
        /// Vendor Name
        /// </summary>
        public string VendorName { get; set; } = string.Empty;

        /// <summary>
        /// Vendor ID
        /// </summary>
        public Guid? VendorId { get; set; }

        /// <summary>
        /// Item Cost
        /// </summary>
        public decimal Cost { get; set; }

        /// <summary>
        /// Retail Price
        /// </summary>
        public decimal RetailPrice { get; set; }

        /// <summary>
        /// Quantity On Hand
        /// </summary>
        public decimal QtyOnHand { get; set; }

        /// <summary>
        /// Reorder Point
        /// </summary>
        public decimal ReorderPoint { get; set; }

        /// <summary>
        /// Is Item Active
        /// </summary>
        public bool IsActive { get; set; }

        /// <summary>
        /// Item Type Name
        /// </summary>
        public string ItemTypeName { get; set; } = string.Empty;

        /// <summary>
        /// Unit of Measure Name
        /// </summary>
        public string UomName { get; set; } = string.Empty;

        /// <summary>
        /// Store Name
        /// </summary>
        public string StoreName { get; set; } = string.Empty;

        /// <summary>
        /// Store ID
        /// </summary>
        public Guid? StoreId { get; set; }

        /// <summary>
        /// Date Item was Created
        /// </summary>
        public DateTime? DateCreated { get; set; }
    }

    /// <summary>
    /// Request DTO for Items Report with pagination and filters
    /// </summary>
    public class ItemsReportRequestDto : PaginationGridDto
    {
        /// <summary>
        /// Department ID filter
        /// </summary>
        public Guid? DepartmentId { get; set; }

        /// <summary>
        /// Item Group ID filter
        /// </summary>
        public Guid? ItemGroupId { get; set; }

        /// <summary>
        /// Vendor ID filter
        /// </summary>
        public Guid? VendorId { get; set; }

        /// <summary>
        /// Manufacturer ID filter
        /// </summary>
        public Guid? ManufacturerId { get; set; }

        /// <summary>
        /// Search text for item no, barcode, description
        /// </summary>
        public string? SearchText { get; set; }

        /// <summary>
        /// Active status filter (null = all, true = active only, false = inactive only)
        /// </summary>
        public bool? IsActive { get; set; }
    }

    /// <summary>
    /// Response DTO with summary totals for Items Report
    /// </summary>
    public class ItemsReportResponseDto
    {
        /// <summary>
        /// List of item records
        /// </summary>
        public List<ItemsReportDto> Data { get; set; } = new();

        /// <summary>
        /// Total records count
        /// </summary>
        public int TotalRecords { get; set; }

        /// <summary>
        /// Total quantity on hand across all items
        /// </summary>
        public decimal TotalQtyOnHand { get; set; }

        /// <summary>
        /// Total retail value (sum of RetailPrice * QtyOnHand)
        /// </summary>
        public decimal TotalRetailValue { get; set; }

        /// <summary>
        /// Total cost value (sum of Cost * QtyOnHand)
        /// </summary>
        public decimal TotalCostValue { get; set; }

        /// <summary>
        /// Count of active items
        /// </summary>
        public int ActiveItemCount { get; set; }

        /// <summary>
        /// Count of inactive items
        /// </summary>
        public int InactiveItemCount { get; set; }
    }
}
