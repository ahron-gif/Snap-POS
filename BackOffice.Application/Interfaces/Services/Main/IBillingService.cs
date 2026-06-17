using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;
using BackOffice.Domain.Enums;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IBillingService
    {
        Task<ApiResponse<EstimatedBillDto>> CalculateEstimatedBillAsync(int customerId);
        Task<ApiResponse<InvoiceDetailDto>> GenerateInvoiceAsync(int customerId, DateTime billingPeriodStart, DateTime billingPeriodEnd);
        Task<ApiResponse<List<InvoiceSummaryDto>>> GetInvoicesForCustomerAsync(int customerId);
        Task<ApiResponse<InvoiceDetailDto>> GetInvoiceByIdAsync(int invoiceId);
        Task<ApiResponse<bool>> MarkInvoicePaidAsync(int invoiceId, string? paymentReference);
        Task<ApiResponse<bool>> RecordPaymentAttemptAsync(int invoiceId, PaymentStatus status, string? failureReason);
        Task<ApiResponse<BillingStatusDto>> GetBillingStatusAsync(int customerId);

        /// <summary>
        /// Returns either a Stripe-hosted invoice URL (if the invoice was synced from Stripe)
        /// or the full invoice detail for the frontend to render in a local modal.
        /// Used by the "View Invoice" button on tenant & admin billing pages.
        /// </summary>
        Task<ApiResponse<InvoiceViewLinkDto>> GetInvoiceViewLinkAsync(int invoiceId, int callerCustomerId, bool isAdmin);
    }
}
