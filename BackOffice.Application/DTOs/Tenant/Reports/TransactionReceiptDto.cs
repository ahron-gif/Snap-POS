using System;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// Request for the "Open Receipt" modal opened from any detail report row that surfaces
    /// a Transaction No. Mirrors the desktop's FrmReciept which calls SP_GetReciept(txId, null).
    /// </summary>
    public class TransactionReceiptRequestDto
    {
        [JsonProperty("transactionId")]
        public Guid? TransactionId { get; set; }

        /// <summary>Optional log id — desktop's second SP arg. Almost always null.</summary>
        [JsonProperty("transLogId")]
        public int? TransLogId { get; set; }
    }

    /// <summary>
    /// Receipt-text payload — single string, formatted exactly like the desktop receipt
    /// (monospaced, line-oriented). Frontend renders it inside a <pre> in the modal.
    /// </summary>
    public class TransactionReceiptResponseDto
    {
        public string ReceiptText { get; set; } = string.Empty;
    }
}
