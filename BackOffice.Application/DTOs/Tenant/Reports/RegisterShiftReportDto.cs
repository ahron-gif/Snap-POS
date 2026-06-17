using System;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// One row of Register Shifts report (Register Shifts desktop form).
    /// Columns: Store Name, Shift No, Register No, Open/Close date & time, Status, Close By, Expected, Pick, Discrepancy.
    /// </summary>
    public class RegisterShiftReportRowDto
    {
        /// <summary>Underlying RegShift.RegShiftID — needed by Reconcile / Total Tenders actions.</summary>
        public Guid? RegShiftID { get; set; }
        public string StoreName { get; set; } = string.Empty;
        public string ShiftNo { get; set; } = string.Empty;
        public string RegisterNo { get; set; } = string.Empty;

        public DateTime? OpenDateTime { get; set; }
        public DateTime? CloseDateTime { get; set; }

        public string Status { get; set; } = string.Empty;
        public string CloseBy { get; set; } = string.Empty;

        /// <summary>
        /// Expected drawer amount (from Z-Out summary).
        /// </summary>
        public decimal Expected { get; set; }

        /// <summary>
        /// Counted drawer amount (from batch closing amount).
        /// </summary>
        public decimal Pick { get; set; }

        /// <summary>
        /// Difference between counted and expected amounts (Pick - Expected).
        /// </summary>
        public decimal Discrepancy { get; set; }
    }

    /// <summary>
    /// Request for Register Shifts report.
    /// </summary>
    public class RegisterShiftReportRequestDto : PaginationGridDto
    {
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
    }

    /// <summary>
    /// Response for Register Shifts report.
    /// </summary>
    public class RegisterShiftReportResponseDto
    {
        public System.Collections.Generic.List<RegisterShiftReportRowDto> Data { get; set; } = new();
        public int TotalRecords { get; set; }
    }
}

