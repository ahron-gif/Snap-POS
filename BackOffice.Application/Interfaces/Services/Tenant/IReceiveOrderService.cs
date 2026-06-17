using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReceiveOrder;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IReceiveOrderService
    {
        /// <summary>
        /// Gets receive orders from the ReceiveOrderView with pagination, filtering, and sorting
        /// </summary>
        ApiResponse<PaginationResponseDTO<ReceiveOrderGridDto>> GetAllReceiveOrdersGridAsync(PaginationGridDto pagination);
    }
}
