using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Register;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IRegisterListService
    {
        ApiResponse<PaginationResponseDTO<RegisterGridDto>> GetAllRegistersGridAsync(PaginationGridDto paginationGridDto);
    }
}
