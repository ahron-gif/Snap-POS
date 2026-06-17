using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Reports;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface ICustomDateScopeService
    {
        ApiResponse<PaginationResponseDTO<CustomDateScopeDto>> GetPagedAsync(PaginationGridDto grid);
        Task<ApiResponse<List<CustomDateScopeDto>>> GetActiveAsync();
        Task<ApiResponse<CustomDateScopeDto>> GetByIdAsync(Guid id);
        Task<ApiResponse<Guid>> CreateAsync(CreateCustomDateScopeDto dto, Guid userId);
        Task<ApiResponse<bool>> UpdateAsync(Guid id, UpdateCustomDateScopeDto dto, Guid userId);
        Task<ApiResponse<bool>> DeleteAsync(Guid id, Guid userId);
        /// <summary>
        /// Soft-deletes a batch of scopes in a single transaction and
        /// re-compacts SortOrder for the remaining active rows so the list
        /// stays a contiguous 1..N sequence. Returns the count actually
        /// deleted (rows already inactive are skipped silently).
        /// </summary>
        Task<ApiResponse<int>> BulkDeleteAsync(List<Guid> ids, Guid userId);
    }
}
