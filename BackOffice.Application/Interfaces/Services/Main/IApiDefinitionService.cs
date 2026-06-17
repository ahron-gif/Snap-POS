using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IApiDefinitionService
    {
        Task<ApiResponse<List<ApiDefinitionDto>>> GetAllApiDefinitionsAsync();
        Task<ApiResponse<ApiDefinitionDto>> CreateApiDefinitionAsync(CreateApiDefinitionDto dto);
        Task<ApiResponse<ApiDefinitionDto>> UpdateApiDefinitionAsync(int id, UpdateApiDefinitionDto dto);
        Task<ApiResponse<bool>> DeleteApiDefinitionAsync(int id);
    }
}
