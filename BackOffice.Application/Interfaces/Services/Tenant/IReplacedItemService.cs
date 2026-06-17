using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReplacedItem;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IReplacedItemService
    {
        Task<ApiResponse<PaginationResponseDTO<ReplacedItemGridDto>>> GetReplacedItemsAsync(
            PaginationGridDto pagination, DateTime? fromDate, DateTime? toDate);
    }
}
