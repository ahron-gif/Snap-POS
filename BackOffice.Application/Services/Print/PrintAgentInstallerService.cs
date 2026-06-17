using System.Security.Cryptography;
using BackOffice.Application.DTOs.Print;
using BackOffice.Application.Interfaces.Services.Print;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BackOffice.Application.Services.Print
{
    public class PrintAgentInstallerService : IPrintAgentInstallerService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<PrintAgentInstallerService> _logger;
        private readonly string _contentRoot;

        public PrintAgentInstallerService(
            IConfiguration configuration,
            ILogger<PrintAgentInstallerService> logger,
            string contentRoot)
        {
            _configuration = configuration;
            _logger = logger;
            _contentRoot = contentRoot;
        }

        public PrintAgentInstallerInfoDto GetInfo()
        {
            var external = GetExternalRedirectUrl();
            var resolvedPath = ResolveLocalPath();

            if (!string.IsNullOrWhiteSpace(external) && !File.Exists(resolvedPath))
            {
                return new PrintAgentInstallerInfoDto
                {
                    Available = true,
                    Version = _configuration["PrintAgent:InstallerVersion"],
                    FileName = ExtractFileNameFromUrl(external),
                    DownloadUrl = external
                };
            }

            if (!File.Exists(resolvedPath))
            {
                return new PrintAgentInstallerInfoDto { Available = false };
            }

            var file = new FileInfo(resolvedPath);
            return new PrintAgentInstallerInfoDto
            {
                Available = true,
                Version = _configuration["PrintAgent:InstallerVersion"]
                          ?? ExtractVersionFromFileName(file.Name),
                FileName = file.Name,
                SizeBytes = file.Length,
                Sha256 = ComputeSha256(file.FullName)
            };
        }

        public bool TryGetFileStream(out FileStream? stream, out string fileName, out long sizeBytes)
        {
            stream = null;
            fileName = string.Empty;
            sizeBytes = 0;

            var resolvedPath = ResolveLocalPath();
            if (string.IsNullOrEmpty(resolvedPath) || !File.Exists(resolvedPath)) return false;

            var file = new FileInfo(resolvedPath);
            stream = new FileStream(file.FullName, FileMode.Open, FileAccess.Read, FileShare.Read);
            fileName = file.Name;
            sizeBytes = file.Length;
            return true;
        }

        public string? GetExternalRedirectUrl()
        {
            var url = _configuration["PrintAgent:InstallerUrl"];
            return string.IsNullOrWhiteSpace(url) ? null : url.Trim();
        }

        private string ResolveLocalPath()
        {
            var configured = _configuration["PrintAgent:InstallerPath"];
            if (string.IsNullOrWhiteSpace(configured)) return string.Empty;

            return Path.IsPathRooted(configured)
                ? configured
                : Path.GetFullPath(Path.Combine(_contentRoot, configured));
        }

        private static string? ExtractVersionFromFileName(string fileName)
        {
            var idx = fileName.LastIndexOf('-');
            if (idx < 0 || idx >= fileName.Length - 1) return null;
            var trailing = fileName[(idx + 1)..];
            var dot = trailing.LastIndexOf('.');
            return dot > 0 ? trailing[..dot] : trailing;
        }

        private static string ExtractFileNameFromUrl(string url)
        {
            var lastSlash = url.LastIndexOf('/');
            return lastSlash >= 0 && lastSlash < url.Length - 1 ? url[(lastSlash + 1)..] : "BackOfficePrintAgentSetup.exe";
        }

        private string ComputeSha256(string path)
        {
            try
            {
                using var sha = SHA256.Create();
                using var fs = File.OpenRead(path);
                var hash = sha.ComputeHash(fs);
                return Convert.ToHexString(hash).ToLowerInvariant();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not compute SHA256 for installer at {Path}", path);
                return string.Empty;
            }
        }
    }
}
