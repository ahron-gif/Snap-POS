using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReceiveTransfer;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IReceiveTransferListService
    {
        ApiResponse<PaginationResponseDTO<ReceiveTransferGridDto>> GetAllReceiveTransfersGridAsync(PaginationGridDto paginationGridDto);
    }
}
