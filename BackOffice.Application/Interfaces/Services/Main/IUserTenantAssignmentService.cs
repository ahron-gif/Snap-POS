using BackOffice.Application.DTOs.Main.UserTenantAssignment;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main;

public interface IUserTenantAssignmentService
{
    Task<ApiResponse<List<TenantLookupDto>>> GetTenantAssignmentsForUserAsync(int userId);
    Task<ApiResponse<bool>> AssignTenantsToUserAsync(AssignTenantsToUserDto dto, int assignedBy);
    Task<ApiResponse<List<UserTenantAssignmentDto>>> GetMyAssignedTenantsAsync(int userId);
}
