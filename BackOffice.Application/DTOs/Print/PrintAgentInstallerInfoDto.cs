namespace BackOffice.Application.DTOs.Print
{
    public class PrintAgentInstallerInfoDto
    {
        public bool Available { get; set; }
        public string? Version { get; set; }
        public string? FileName { get; set; }
        public long SizeBytes { get; set; }
        public string? DownloadUrl { get; set; }
        public string? Sha256 { get; set; }
    }
}
