using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Payment;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IPaymentService
    {
        /// <summary>
        /// Gets payments from the PaymentsView with pagination, filtering, and sorting
        /// </summary>
        ApiResponse<PaginationResponseDTO<PaymentGridDto>> GetAllPaymentsGridAsync(PaginationGridDto pagination);
    }
}
