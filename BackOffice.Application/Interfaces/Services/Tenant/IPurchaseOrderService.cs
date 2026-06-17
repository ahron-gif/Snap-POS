using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.PurchaseOrder;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IPurchaseOrderService
    {
        /// <summary>
        /// Gets purchase orders from the PurchaseOrdersView with pagination, filtering, and sorting
        /// </summary>
        ApiResponse<PaginationResponseDTO<PurchaseOrderGridDto>> GetAllPurchaseOrdersGridAsync(PaginationGridDto pagination);
    }
}
