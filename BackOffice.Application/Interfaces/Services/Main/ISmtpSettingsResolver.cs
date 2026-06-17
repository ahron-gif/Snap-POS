using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Main;

public interface ISmtpSettingsResolver
{
    Task<SmtpSettings> ResolveAsync(int? customerId, Guid? storeId, CancellationToken ct = default);
}
