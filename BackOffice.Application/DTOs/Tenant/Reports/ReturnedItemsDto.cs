using System;
using BackOffice.Application.DTOs;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// DTO for Returned Items Report row
    /// </summary>
    public class ReturnedItemsDto
    {
        public Guid? Id { get; set; }
        public Guid? StoreId { get; set; }

        // Columns matching the legacy desktop report
        public string Name { get; set; } = string.Empty;
        public string Upc { get; set; } = string.Empty;
        public string ModelNumber { get; set; } = string.Empty;
        public string ReturnReason { get; set; } = string.Empty;
        public string SupplierName { get; set; } = string.Empty;
        public decimal? QuantityReturned { get; set; }
        public decimal? Amount { get; set; }
        public string Department { get; set; } = string.Empty;
        public string StyleNo { get; set; } = string.Empty;

        // Extra/internal fields (can be used for drill‑downs, etc.)
        public Guid? TransactionId { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        public string StoreName { get; set; } = string.Empty;
        public DateTime? Date { get; set; }
        public string ItemCode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request DTO for Returned Items Report with pagination and filters
    /// </summary>
    public class ReturnedItemsRequestDto : PaginationGridDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
    }

    /// <summary>
    /// Response DTO for Returned Items Report
    /// </summary>
    public class ReturnedItemsResponseDto
    {
        public List<ReturnedItemsDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}
