using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of the Daily Hour Sales report: aggregated sales metrics per store/hour.
    /// `Date`, `OrderCol` and `StoreId` are needed by the drill-down (row double-click) so
    /// the details endpoint can scope its SP_GetInvoices filter to the same date/hour/store.
    /// </summary>
    public class DailyHourSalesRowDto
    {
        public string StoreName { get; set; } = string.Empty;
        public string WeekDay { get; set; } = string.Empty;
        public string Hour { get; set; } = string.Empty;
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal Balance { get; set; }
        public int CountTransaction { get; set; }
        public int Registers { get; set; }
        public double SalePrec { get; set; }
        public int Customers { get; set; }
        public int TransactionWithCustomer { get; set; }
        public double CustomerPrec { get; set; }
        public decimal CustomerDebit { get; set; }
        public decimal Items { get; set; }

        /// <summary>Date the bucket belongs to (mm/dd/yyyy from SP).</summary>
        public string Date { get; set; } = string.Empty;
        /// <summary>Bucket start as a DateTime — used by the drill-down to construct an [hour, hour+1) range.</summary>
        public DateTime? OrderCol { get; set; }
        /// <summary>Store ID for this row — used by the drill-down to scope details to the same store.</summary>
        public Guid? StoreId { get; set; }
    }

    /// <summary>
    /// Request for the Daily Hour Sales drill-down. Frontend sends the row's `OrderCol`
    /// (bucket start) and `StoreId`; backend computes the [OrderCol, OrderCol + 1h) range
    /// and queries SP_GetInvoices for transactions in that window for that store.
    /// </summary>
    public class DailyHourSalesDetailsRequestDto
    {
        [JsonProperty("hourStart")]
        public DateTime? HourStart { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }
    }

    /// <summary>
    /// One row of the Daily Hour Sales drill-down: a single transaction from SP_GetInvoices
    /// scoped to the hour bucket the user double-clicked.
    /// </summary>
    public class DailyHourSalesDetailsRowDto
    {
        public string No { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public DateTime? Date { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string CustomerNo { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public decimal? Total { get; set; }
        public decimal? OpenBalance { get; set; }
        public decimal? AmountPay { get; set; }
        public decimal? Amount { get; set; }
        public Guid? TransactionId { get; set; }
    }

    public class DailyHourSalesDetailsResponseDto
    {
        public List<DailyHourSalesDetailsRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalAmount { get; set; }
        public string HourLabel { get; set; } = string.Empty;
        public string StoreName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request for Daily Hour Sales report: date range, optional store, and report type (e.g. by hour or summary).
    /// </summary>
    public class DailyHourSalesRequestDto
    {
        [JsonProperty("fromDate")]
        public DateTime? FromDate { get; set; }

        [JsonProperty("toDate")]
        public DateTime? ToDate { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }

        /// <summary>
        /// Optional report type flag passed to SP_GetDailyHourSales (null or 0 for default desktop-style behaviour).
        /// </summary>
        [JsonProperty("reportType")]
        public int? ReportType { get; set; }
    }

    /// <summary>
    /// Response for Daily Hour Sales report.
    /// </summary>
    public class DailyHourSalesResponseDto
    {
        public List<DailyHourSalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalDebit { get; set; }
        public decimal TotalCredit { get; set; }
        public decimal TotalBalance { get; set; }
    }
}

