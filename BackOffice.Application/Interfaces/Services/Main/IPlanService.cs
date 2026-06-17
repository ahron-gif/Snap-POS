using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IPlanService
    {
        ApiResponse<PaginationResponseDTO<PlanDto>> GetPlansGrid(PaginationGridDto dto);
        Task<ApiResponse<PlanDto>> GetPlanByIdAsync(int id);
        Task<ApiResponse<List<PlanDto>>> GetAllPlansLookupAsync();
        Task<ApiResponse<int>> CreatePlanAsync(CreatePlanDto dto);
        Task<ApiResponse<bool>> UpdatePlanAsync(UpdatePlanDto dto);
        Task<ApiResponse<bool>> DeletePlanAsync(int id);
        Task<ApiResponse<List<ModuleDto>>> GetPlanModulesAsync(int planId);
        Task<ApiResponse<bool>> UpdatePlanModulesAsync(int planId, List<int> moduleIds);
    }
}
