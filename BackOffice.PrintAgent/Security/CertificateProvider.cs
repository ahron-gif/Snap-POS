using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.Options;

namespace BackOffice.PrintAgent.Security;

public class CertificateProvider
{
    private readonly PrintAgentSettings _settings;
    private readonly ILogger<CertificateProvider> _logger;

    public CertificateProvider(IOptions<PrintAgentSettings> settings, ILogger<CertificateProvider> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public X509Certificate2 LoadOrCreate()
    {
        var path = _settings.ResolvedCertPath;
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

        if (File.Exists(path))
        {
            try
            {
                var loaded = new X509Certificate2(path, _settings.Certificate.Password, X509KeyStorageFlags.MachineKeySet | X509KeyStorageFlags.PersistKeySet | X509KeyStorageFlags.Exportable);
                if (loaded.NotAfter > DateTime.UtcNow.AddDays(7))
                {
                    EnsureTrusted(loaded);
                    return loaded;
                }
                _logger.LogInformation("Existing cert near expiry, regenerating");
                RemoveFromTrustStore(loaded.Thumbprint);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load cert from {Path}, regenerating", path);
            }
        }

        var cert = GenerateSelfSigned(_settings.Hostname);
        var bytes = cert.Export(X509ContentType.Pfx, _settings.Certificate.Password);
        File.WriteAllBytes(path, bytes);
        _logger.LogInformation("Generated self-signed cert for {Hostname} at {Path}", _settings.Hostname, path);
        var loadedFresh = new X509Certificate2(bytes, _settings.Certificate.Password, X509KeyStorageFlags.MachineKeySet | X509KeyStorageFlags.PersistKeySet | X509KeyStorageFlags.Exportable);
        EnsureTrusted(loadedFresh);
        return loadedFresh;
    }

    private void EnsureTrusted(X509Certificate2 cert)
    {
        try
        {
            using var store = new X509Store(StoreName.Root, StoreLocation.LocalMachine);
            store.Open(OpenFlags.ReadWrite);
            var existing = store.Certificates.Find(X509FindType.FindByThumbprint, cert.Thumbprint, validOnly: false);
            if (existing.Count > 0) return;

            store.Add(cert);
            _logger.LogInformation("Installed agent cert {Thumbprint} into LocalMachine/Root trust store", cert.Thumbprint);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not install cert into LocalMachine/Root. Service must run as LocalSystem or Administrator.");
        }
    }

    private void RemoveFromTrustStore(string thumbprint)
    {
        try
        {
            using var store = new X509Store(StoreName.Root, StoreLocation.LocalMachine);
            store.Open(OpenFlags.ReadWrite);
            var existing = store.Certificates.Find(X509FindType.FindByThumbprint, thumbprint, validOnly: false);
            foreach (var c in existing)
            {
                store.Remove(c);
                _logger.LogInformation("Removed expired cert {Thumbprint} from LocalMachine/Root", thumbprint);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not remove old cert {Thumbprint} from LocalMachine/Root", thumbprint);
        }
    }

    private static X509Certificate2 GenerateSelfSigned(string hostname)
    {
        using var rsa = RSA.Create(2048);
        var req = new CertificateRequest($"CN={hostname}", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

        var sanBuilder = new SubjectAlternativeNameBuilder();
        sanBuilder.AddDnsName(hostname);
        sanBuilder.AddDnsName("localhost");
        sanBuilder.AddIpAddress(System.Net.IPAddress.Loopback);
        sanBuilder.AddIpAddress(System.Net.IPAddress.IPv6Loopback);
        req.CertificateExtensions.Add(sanBuilder.Build());

        req.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
        req.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        req.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new("1.3.6.1.5.5.7.3.1") }, true));

        return req.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddYears(2));
    }
}
