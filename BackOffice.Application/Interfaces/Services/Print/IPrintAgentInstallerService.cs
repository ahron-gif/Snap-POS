using BackOffice.Application.DTOs.Print;

namespace BackOffice.Application.Interfaces.Services.Print
{
    public interface IPrintAgentInstallerService
    {
        PrintAgentInstallerInfoDto GetInfo();
        bool TryGetFileStream(out FileStream? stream, out string fileName, out long sizeBytes);
        string? GetExternalRedirectUrl();
    }
}
