using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface ICustomerAppLicenseService
    {
        Task<ApiResponse<List<CustomerAppLicenseDto>>> GetLicensesAsync(int customerId, bool includeRemoved);

        Task<ApiResponse<LicenseSummaryDto>> GetSummaryAsync(int customerId);

        Task<ApiResponse<CustomerAppLicenseDto>> AddLicenseAsync(int customerId, AddLicenseDto dto, int createdBy);

        Task<ApiResponse<bool>> RequestRemovalAsync(int customerId, int licenseId, int removedBy);

        Task<ApiResponse<bool>> SyncBaselineLicensesAsync(int customerId, int planId, int? changedBy);
    }
}
