using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Store;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IStoreListService
    {
        ApiResponse<PaginationResponseDTO<StoreGridDto>> GetAllStoresGridAsync(PaginationGridDto paginationGridDto);
    }
}
