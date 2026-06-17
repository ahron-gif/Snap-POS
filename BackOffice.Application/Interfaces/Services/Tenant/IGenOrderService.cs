using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.GenOrder;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IGenOrderService
    {
        /// <summary>
        /// Gets general order items from the GenOrderView with pagination, filtering, and sorting
        /// </summary>
        ApiResponse<PaginationResponseDTO<GenOrderGridDto>> GetAllGenOrdersGridAsync(PaginationGridDto pagination);
    }
}
