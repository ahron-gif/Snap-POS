using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.ApplicationRegistration;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.SmartKartReg
{
    public interface IAppRegistrationService
    {
        ApiResponse<PaginationResponseDTO<AppRegistrationGridDto>> GetAllAppRegistrationsGrid(PaginationGridDto paginationGridDto);
        Task<ApiResponse<AppRegistrationDetailDto>> GetAppRegistrationByIdAsync(Guid id);
        Task<ApiResponse<Guid>> CreateAppRegistrationAsync(CreateAppRegistrationDto dto);
        Task<ApiResponse<bool>> UpdateAppRegistrationAsync(UpdateAppRegistrationDto dto);
        Task<ApiResponse<bool>> DeleteAppRegistrationAsync(Guid id);
    }
}
