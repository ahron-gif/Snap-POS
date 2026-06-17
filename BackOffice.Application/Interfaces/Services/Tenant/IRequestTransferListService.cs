using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.RequestTransfer;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IRequestTransferListService
    {
        ApiResponse<PaginationResponseDTO<RequestTransferGridDto>> GetAllRequestTransfersGridAsync(PaginationGridDto paginationGridDto);
    }
}
