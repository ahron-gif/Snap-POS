using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReturnToVendor;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IReturnToVendorService
    {
        /// <summary>
        /// Gets return to vendor records from the ReturnToVenderView with pagination, filtering, and sorting
        /// </summary>
        ApiResponse<PaginationResponseDTO<ReturnToVendorGridDto>> GetAllReturnToVendorsGridAsync(PaginationGridDto pagination);
    }
}
