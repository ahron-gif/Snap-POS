using System;
using System.Collections.Generic;
using BackOffice.Application.Converters;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// Generic id/name pair returned for filter dropdowns on the Action Summary report.
    /// </summary>
    public class ActionLookupOption
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }

    /// <summary>
    /// One row of the Action Summary report: aggregated POS actions per date/cashier/action.
    /// IDs are exposed so the UI can drill down into Action Details with the same scope.
    /// </summary>
    public class ActionSummaryRowDto
    {
        public Guid? StoreId { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public string ActionDate { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public int Times { get; set; }
        public string Cashier { get; set; } = string.Empty;
        public string BatchNumber { get; set; } = string.Empty;
        public Guid? BatchId { get; set; }
        public Guid? CashierId { get; set; }
        public int? ActionType { get; set; }
    }

    /// <summary>
    /// Request for Action Summary report: date range, optional store, and the four desktop-parity
    /// filters (Batch / Register / Cashier / Approve By). Inherits PaginationGridDto for StartRow/EndRow
    /// pagination handled by the Web_ SP.
    /// </summary>
    public class ActionSummaryRequestDto : PaginationGridDto
    {
        [JsonProperty("fromDate")]
        public DateTime? FromDate { get; set; }

        [JsonProperty("toDate")]
        public DateTime? ToDate { get; set; }

        /// <summary>Optional cashier name filter (kept for backward compatibility).</summary>
        [JsonProperty("cashier")]
        public string? Cashier { get; set; }

        /// <summary>Optional action name filter (kept for backward compatibility).</summary>
        [JsonProperty("action")]
        public string? Action { get; set; }

        /// <summary>Optional batch number filter (kept for backward compatibility).</summary>
        [JsonProperty("batchNumber")]
        public string? BatchNumber { get; set; }

        /// <summary>Optional action type filter (numeric SystemValueNo from SystemValues).</summary>
        [JsonProperty("actionType")]
        public int? ActionType { get; set; }

        /// <summary>Optional batch ID filter — when present the date range is ignored (desktop parity).</summary>
        [JsonProperty("batchId")]
        public Guid? BatchId { get; set; }

        /// <summary>Optional register ID filter — Actions.RegisterID.</summary>
        [JsonProperty("registerId")]
        public Guid? RegisterId { get; set; }

        /// <summary>Optional cashier user ID filter — Batch.CashierID.</summary>
        [JsonProperty("cashierId")]
        public Guid? CashierId { get; set; }

        /// <summary>Optional Approve By user ID filter — Actions.UserID.</summary>
        [JsonProperty("approveById")]
        public Guid? ApproveById { get; set; }
    }

    /// <summary>
    /// Response for Action Summary report. Lookup option lists are populated only on the first
    /// page (StartRow == 0) — subsequent paginated requests return empty arrays so the UI can
    /// keep the values cached from the initial page.
    /// </summary>
    public class ActionSummaryResponseDto
    {
        public List<ActionSummaryRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
        public int TotalTimes { get; set; }

        /// <summary>Distinct cashier names in the result set (legacy string list).</summary>
        public List<string> Cashiers { get; set; } = new();
        /// <summary>Distinct action names in the result set (legacy string list).</summary>
        public List<string> Actions { get; set; } = new();
        /// <summary>Distinct batch numbers in the result set (legacy string list).</summary>
        public List<string> BatchNumbers { get; set; } = new();

        /// <summary>Batches present in the filtered set — id is BatchID, name is BatchNumber.</summary>
        public List<ActionLookupOption> BatchOptions { get; set; } = new();
        /// <summary>Registers present in the filtered set — id is RegisterID, name is CompName.</summary>
        public List<ActionLookupOption> RegisterOptions { get; set; } = new();
        /// <summary>Cashier users present in the filtered set — id is UserId, name is UserName.</summary>
        public List<ActionLookupOption> CashierOptions { get; set; } = new();
        /// <summary>Approve-By users present in the filtered set — id is UserId, name is UserName.</summary>
        public List<ActionLookupOption> ApproveByOptions { get; set; } = new();
    }
}
