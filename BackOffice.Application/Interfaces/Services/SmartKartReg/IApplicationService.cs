using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.Application;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.SmartKartReg
{
    public interface IApplicationService
    {
        ApiResponse<PaginationResponseDTO<ApplicationGridDto>> GetAllApplicationsGrid(PaginationGridDto paginationGridDto);
        Task<ApiResponse<ApplicationDetailDto>> GetApplicationByIdAsync(Guid id);
        Task<ApiResponse<Guid>> CreateApplicationAsync(CreateApplicationDto dto);
        Task<ApiResponse<bool>> UpdateApplicationAsync(UpdateApplicationDto dto);
        Task<ApiResponse<bool>> DeleteApplicationAsync(Guid id);
        Task<ApiResponse<List<ApplicationDropdownDto>>> GetApplicationsDropdownAsync();
    }
}
