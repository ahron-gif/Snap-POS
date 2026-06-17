using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface ITenantPermissionService
    {
        Task<ApiResponse<TenantPermissionCeilingDto>> GetTenantCeilingAsync(int tenantId);
        Task<ApiResponse<List<TenantAllowedModuleDto>>> GetTenantAllowedModulesAsync(int tenantId);
        Task<ApiResponse<bool>> UpdateTenantAllowedModulesAsync(UpdateTenantAllowedModulesDto dto, int grantedByUserId);
        Task<ApiResponse<List<TenantAllowedPermissionDto>>> GetTenantAllowedPermissionsAsync(int tenantId);
        Task<ApiResponse<bool>> UpdateTenantAllowedPermissionsAsync(UpdateTenantAllowedPermissionsDto dto, int grantedByUserId);
        Task<ApiResponse<bool>> EnableAllPermissionsForTenantAsync(int tenantId, int grantedByUserId);
        Task<ApiResponse<bool>> SyncTenantPermissionsFromPlanAsync(int tenantId);
    }
}
