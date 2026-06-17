using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IPermissionRegistryService
    {
        Task<ApiResponse<List<ModuleTreeDto>>> GetModuleTreeAsync();
        /// <summary>Get module by name (from header); used to resolve ModuleId when saving a screen.</summary>
        Task<ApiResponse<ModuleDto>> GetModuleByNameAsync(string moduleName);
        Task<ApiResponse<List<ScreenDto>>> GetScreensByModuleAsync(int moduleId);
        Task<ApiResponse<List<PermissionDto>>> GetPermissionsByScreenAsync(int screenId);
        Task<ApiResponse<List<PermissionDto>>> GetAllPermissionsAsync();
        Task<ApiResponse<int>> CreateScreenAsync(CreateScreenDto dto);
        Task<ApiResponse<bool>> UpdateScreenAsync(UpdateScreenDto dto);
        Task<ApiResponse<int>> CreatePermissionAsync(CreatePermissionDto dto);
        Task<ApiResponse<bool>> UpdatePermissionAsync(UpdatePermissionDto dto);
        Task SeedPermissionsAsync();
    }
}
