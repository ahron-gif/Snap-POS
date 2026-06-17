using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.Registration;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.SmartKartReg
{
    public interface IRegistrationService
    {
        ApiResponse<PaginationResponseDTO<RegistrationGridDto>> GetAllRegistrationsGrid(PaginationGridDto paginationGridDto);
        Task<ApiResponse<RegistrationDetailDto>> GetRegistrationByIdAsync(Guid id);
        Task<ApiResponse<Guid>> CreateRegistrationAsync(CreateRegistrationDto dto);
        Task<ApiResponse<bool>> UpdateRegistrationAsync(UpdateRegistrationDto dto);
        Task<ApiResponse<bool>> DeleteRegistrationAsync(Guid id);
    }
}
