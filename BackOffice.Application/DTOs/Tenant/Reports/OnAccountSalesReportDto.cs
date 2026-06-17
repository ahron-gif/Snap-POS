using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of the On Account Sales report (desktop-style): one line per on-account transaction.
    /// </summary>
    public class OnAccountSalesRowDto
    {
        public Guid? StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public Guid? CustomerId { get; set; }
        public string CustomerNo { get; set; } = string.Empty;
        /// <summary>
        /// Full customer name (for backwards compatibility / legacy desktop layout).
        /// </summary>
        public string Name { get; set; } = string.Empty;
        /// <summary>
        /// Customer last name, to match desktop \"On Account\" columns.
        /// </summary>
        public string LastName { get; set; } = string.Empty;
        /// <summary>
        /// Customer first name, to match desktop \"On Account\" columns.
        /// </summary>
        public string FirstName { get; set; } = string.Empty;
        /// <summary>
        /// Customer address line shown in the desktop report.
        /// </summary>
        public string Address { get; set; } = string.Empty;
        /// <summary>
        /// Primary phone number shown in the desktop report.
        /// </summary>
        public string Phone { get; set; } = string.Empty;
        public string TransactionNo { get; set; } = string.Empty;
        public DateTime? SaleTime { get; set; }
        public string UserName { get; set; } = string.Empty;
        public decimal Sale { get; set; }
        public decimal AmountPayments { get; set; }
        public decimal AmountSales { get; set; }
        public decimal BalanceDoe { get; set; }
    }

    /// <summary>
    /// Request for On Account Sales report: date range, optional store and customer.
    /// </summary>
    public class OnAccountSalesRequestDto
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
    /// Response for On Account Sales report.
    /// </summary>
    public class OnAccountSalesResponseDto
    {
        public List<OnAccountSalesRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal TotalSale { get; set; }
        public decimal TotalPayments { get; set; }
        public decimal TotalBalance { get; set; }
    }

    // -----------------------------------------------------------------------------
    // Drill-down: per-transaction rows for a single customer in the same date range.
    // Desktop equivalent: RepAcountReceivableSales -> ClickOnRow -> FrmLiveReport
    // which opens a "Account Receivable Sales For <NAME>" detail screen.
    // -----------------------------------------------------------------------------

    public class OnAccountSalesDetailsRequestDto
    {
        [JsonProperty("fromDate")]
        public DateTime? FromDate { get; set; }

        [JsonProperty("toDate")]
        public DateTime? ToDate { get; set; }

        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }

        /// <summary>Customer GUID (preferred). When null, server falls back to <see cref="CustomerNo"/>.</summary>
        [JsonProperty("customerId")]
        public Guid? CustomerId { get; set; }

        /// <summary>Customer No (phone-formatted key) — fallback identifier when CustomerId is unknown on the client.</summary>
        [JsonProperty("customerNo")]
        public string? CustomerNo { get; set; }

        /// <summary>"sales" (default) or "payments" — drives the per-row Amount column shown in the detail grid.</summary>
        [JsonProperty("mode")]
        public string? Mode { get; set; }
    }

    /// <summary>
    /// One transaction-level row for the drill-down ("Account Receivable Sales For NAME").
    /// </summary>
    public class OnAccountSalesDetailsRowDto
    {
        public string TransactionNo { get; set; } = string.Empty;
        /// <summary>"Sale" / "Payment" / "Return" — matches the desktop's Type column.</summary>
        public string Type { get; set; } = string.Empty;
        public DateTime? Date { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string CustomerNo { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        /// <summary>Running balance after this row (BalanceDoe).</summary>
        public decimal Total { get; set; }
        /// <summary>Per-row amount — AmountSales for the Sales view, AmountPayments for the Payments view.</summary>
        public decimal Amount { get; set; }
        public decimal AmountSales { get; set; }
        public decimal AmountPayments { get; set; }
    }

    public class OnAccountSalesDetailsResponseDto
    {
        public List<OnAccountSalesDetailsRowDto> Rows { get; set; } = new();
        public int TotalRecords { get; set; }
        public decimal GrandTotalAmount { get; set; }
        public string CustomerNo { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
    }
}

