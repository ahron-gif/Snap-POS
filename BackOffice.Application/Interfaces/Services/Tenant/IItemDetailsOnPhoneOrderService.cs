using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ItemDetailsOnPhoneOrder;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IItemDetailsOnPhoneOrderService
    {
        Task<ApiResponse<PaginationResponseDTO<ItemDetailsOnPhoneOrderGridDto>>> GetItemDetailsOnPhoneOrderAsync(
            PaginationGridDto pagination, string? phoneStatus, string? itemStoreId);
    }
}
