using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Transfer;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface ITransferItemsListService
    {
        ApiResponse<PaginationResponseDTO<TransferGridDto>> GetAllTransfersGridAsync(PaginationGridDto paginationGridDto);
    }
}
