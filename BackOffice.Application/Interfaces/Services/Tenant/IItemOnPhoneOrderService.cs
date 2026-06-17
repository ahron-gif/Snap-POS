using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ItemOnPhoneOrder;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IItemOnPhoneOrderService
    {
        Task<ApiResponse<PaginationResponseDTO<ItemOnPhoneOrderGridDto>>> GetItemsOnPhoneOrderAsync(
            PaginationGridDto pagination, string? phoneStatus, bool aggregated);
    }
}
