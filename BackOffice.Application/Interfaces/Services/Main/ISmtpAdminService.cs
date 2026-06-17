using BackOffice.Application.DTOs.Main.SmtpSettings;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main;

public interface ISmtpAdminService
{
    Task<ApiResponse<SmtpSettingsDto>> GetAsync(int customerId, Guid storeId);
    Task<ApiResponse<List<SmtpStoreLookupDto>>> GetStoresAsync(int customerId);
    Task<ApiResponse<object>> UpdateAsync(int customerId, SmtpSettingsUpdateDto dto, Guid? userId);
}
