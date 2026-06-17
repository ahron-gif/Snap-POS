using System;
using System.Collections.Generic;
using BackOffice.Application.Converters;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of the Action Details report: detail-level POS action (from SP_GetActionDetailsByDate).
    /// </summary>
    public class ActionDetailsRowDto
    {
        public string Action { get; set; } = string.Empty;
        public DateTime? TranDate { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        public string Register { get; set; } = string.Empty;
        public string ApproveBy { get; set; } = string.Empty;
        public decimal? Amount { get; set; }
        public string Info { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request for Action Details report: date range, optional store, and the per-row drill-down
    /// filters used when the user double-clicks an Action Summary row (BatchID / CashierID /
    /// ActionType / RegisterID / Approve-By UserID). Inherits PaginationGridDto for pagination.
    /// </summary>
    public class ActionDetailsRequestDto : PaginationGridDto
    {
        [JsonProperty("fromDate")]
        public DateTime? FromDate { get; set; }

        [JsonProperty("toDate")]
        public DateTime? ToDate { get; set; }

        /// <summary>Optional batch ID — Actions.BatchID / Batch.BatchID.</summary>
        [JsonProperty("batchId")]
        public Guid? BatchId { get; set; }

        /// <summary>Optional cashier user ID — Batch.CashierID.</summary>
        [JsonProperty("cashierId")]
        public Guid? CashierId { get; set; }

        /// <summary>Optional action type — Actions.ActionType.</summary>
        [JsonProperty("actionType")]
        public int? ActionType { get; set; }

        /// <summary>Optional register ID — Actions.RegisterID.</summary>
        [JsonProperty("registerId")]
        public Guid? RegisterId { get; set; }

        /// <summary>Optional Approve-By user ID — Actions.UserID.</summary>
        [JsonProperty("approveById")]
        public Guid? ApproveById { get; set; }
    }

    /// <summary>
    /// Response for Action Details report. Lookup option lists mirror the Action Summary
    /// response — populated only on the first page (StartRow == 0); subsequent paginated
    /// requests return empty arrays and the UI keeps the page-1 values cached.
    /// </summary>
    public class ActionDetailsResponseDto
    {
        public List<ActionDetailsRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }

        /// <summary>Batches present in the filtered set — id is BatchID, name is BatchNumber.</summary>
        public List<ActionLookupOption> BatchOptions { get; set; } = new();
        /// <summary>Registers — full Registers table (desktop parity, not scoped to filter).</summary>
        public List<ActionLookupOption> RegisterOptions { get; set; } = new();
        /// <summary>Active users (Status &gt; -1) — bound to Cashier dropdown (desktop parity).</summary>
        public List<ActionLookupOption> CashierOptions { get; set; } = new();
        /// <summary>Active users (Status &gt; -1) — bound to Approve By dropdown (desktop parity, same source as Cashier).</summary>
        public List<ActionLookupOption> ApproveByOptions { get; set; } = new();
    }
}
