using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Computer;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IComputerListService
    {
        ApiResponse<PaginationResponseDTO<ComputerGridDto>> GetAllComputersGridAsync(PaginationGridDto paginationGridDto);
    }
}
