using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.PurchaseOrder;
using BackOffice.Common;
namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IPurchaseOrderService
    {
        ApiResponse<PaginationResponseDTO<PurchaseOrderGridDto>> GetAllPurchaseOrdersGridAsync(PaginationGridDto pagination);
        Task<ApiResponse<PurchaseOrderDetailDto>> GetPurchaseOrderByIdAsync(Guid id);
        Task<ApiResponse<PurchaseOrderDetailDto>> CreatePurchaseOrderAsync(CreatePurchaseOrderDto dto, Guid creatorId);
        Task<ApiResponse<PurchaseOrderDetailDto>> UpdatePurchaseOrderAsync(Guid id, UpdatePurchaseOrderDto dto, Guid modifierId);
        Task<ApiResponse<bool>> DeletePurchaseOrderAsync(Guid id, Guid modifierId);
        Task<ApiResponse<bool>> ApprovePurchaseOrderAsync(Guid id, Guid modifierId);
        Task<ApiResponse<bool>> SendPurchaseOrderAsync(Guid id, Guid modifierId);
    }
}
