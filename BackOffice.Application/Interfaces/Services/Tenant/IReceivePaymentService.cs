using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReceivePayment;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IReceivePaymentService
    {
        ApiResponse<PaginationResponseDTO<ReceivePaymentGridDto>> GetAllReceivePaymentsGridAsync(PaginationGridDto paginationGridDto);
    }
}
