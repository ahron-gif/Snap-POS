namespace BackOffice.PrintAgent;

public class PrintAgentSettings
{
    public string Version { get; set; } = "0.0.0";
    public string Hostname { get; set; } = "agent.backoffice.local";
    public int HttpsPort { get; set; } = 9443;
    public List<string> AllowedOrigins { get; set; } = new();
    public string PairingFilePath { get; set; } = "%PROGRAMDATA%/BackOfficePrintAgent/pairing.json";
    public string LogPath { get; set; } = "%PROGRAMDATA%/BackOfficePrintAgent/logs/agent-.log";
    public CertificateSettings Certificate { get; set; } = new();
    public RateLimitSettings RateLimit { get; set; } = new();

    public string ResolvedPairingFilePath => Environment.ExpandEnvironmentVariables(PairingFilePath);
    public string ResolvedLogPath => Environment.ExpandEnvironmentVariables(LogPath);
    public string ResolvedCertPath => Environment.ExpandEnvironmentVariables(Certificate.Path);
}

public class CertificateSettings
{
    public string Path { get; set; } = "";
    public string Password { get; set; } = "";
}

public class RateLimitSettings
{
    public int PermitLimit { get; set; } = 50;
    public int WindowSeconds { get; set; } = 60;
}
