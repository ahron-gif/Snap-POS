using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One tender row in the Reconcile Batch screen (desktop BatchReconciles.LoadGrid).
    /// Mirrors the BatchRec table joined with RegShift to surface OpeningAmount for CASH.
    /// </summary>
    public class ReconcileBatchRowDto
    {
        public int BatchRecID { get; set; }
        public int TenderID { get; set; }
        public string TenderName { get; set; } = string.Empty;
        public decimal? ExpectedAmount { get; set; }
        public int? ExpectedCount { get; set; }
        public decimal? PickUpAmount { get; set; }
        public int? PickUpCount { get; set; }
        public decimal? OverShort { get; set; }
        public string? Note { get; set; }
    }

    /// <summary>
    /// Init request: ensures BatchRec rows exist for the shift (calls SP_AddBatchToRec)
    /// and returns the tender list.
    /// </summary>
    public class ReconcileBatchInitRequestDto
    {
        public Guid RegShiftID { get; set; }
    }

    public class ReconcileBatchInitResponseDto
    {
        public Guid RegShiftID { get; set; }
        public string ShiftNo { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal? OpeningAmount { get; set; }
        public List<ReconcileBatchRowDto> Rows { get; set; } = new();
    }

    /// <summary>
    /// Save request: updates PickUpAmount/PickUpCount/Note per tender row and marks
    /// the shift as RECONCILE (Status = 3), mirroring BatchReconciles.BtnSave_Click.
    /// </summary>
    public class ReconcileBatchSaveRowDto
    {
        public int BatchRecID { get; set; }
        public decimal? PickUpAmount { get; set; }
        public int? PickUpCount { get; set; }
        public string? Note { get; set; }
    }

    public class ReconcileBatchSaveRequestDto
    {
        public Guid RegShiftID { get; set; }
        public List<ReconcileBatchSaveRowDto> Rows { get; set; } = new();
    }

    public class ReconcileBatchSaveResponseDto
    {
        public Guid RegShiftID { get; set; }
        public int UpdatedRows { get; set; }
        public string NewStatus { get; set; } = "RECONCILE";
    }

    // --------------------------------------------------------------------------------------
    // Total Tenders for a single shift (desktop RepTendersShift)
    // --------------------------------------------------------------------------------------

    public class TotalTendersForShiftRequestDto
    {
        public Guid RegShiftID { get; set; }
    }

    /// <summary>
    /// One row per TenderEntry — matches the desktop RepTendersShift grid (Tender / Transaction No / Date / Amount / Time / No).
    /// </summary>
    public class TotalTendersForShiftRowDto
    {
        public int TenderID { get; set; }
        public string TenderName { get; set; } = string.Empty;
        public Guid? TransactionID { get; set; }
        public string TransactionNo { get; set; } = string.Empty;
        /// <summary>StartSaleTime — frontend splits into Date / Time columns.</summary>
        public DateTime? Date { get; set; }
        public decimal Amount { get; set; }
        public string? CreditType { get; set; }
    }

    public class TotalTendersForShiftResponseDto
    {
        public Guid RegShiftID { get; set; }
        public string ShiftNo { get; set; } = string.Empty;
        public List<TotalTendersForShiftRowDto> Rows { get; set; } = new();
        public decimal GrandTotalAmount { get; set; }
        public int GrandTotalCount { get; set; }
    }
}
