using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of the On Account Payments report (desktop-style): payments on customer accounts aggregated per customer.
    /// </summary>
    public class OnAccountPaymentsRowDto
    {
        public Guid? StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public Guid? CustomerId { get; set; }
        public string CustomerNo { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        /// <summary>
        /// Total payment amount on account for the customer in the requested date range.
        /// </summary>
        public decimal Amount { get; set; }
    }

    /// <summary>
    /// Request for On Account Payments report: date range, optional store and customer.
    /// </summary>
    public class OnAccountPaymentsRequestDto
    {
        [JsonProperty("fromDate")]
        public DateTime? FromDate { get; set; }

        [JsonProperty("toDate")]
        public DateTime? ToDate { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }

        [JsonProperty("customerId")]
        public Guid? CustomerId { get; set; }
    }

    /// <summary>
    /// Response for On Account Payments report.
    /// </summary>
    public class OnAccountPaymentsResponseDto
    {
        public List<OnAccountPaymentsRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalAmount { get; set; }
    }
}

