using System.Security.Cryptography;
using System.Text.Json;
using BackOffice.PrintAgent.Services.Models;
using Microsoft.Extensions.Options;

namespace BackOffice.PrintAgent.Services;

public class PairingService : IPairingService
{
    private readonly object _lock = new();
    private readonly string _filePath;
    private readonly ILogger<PairingService> _logger;
    private PairingInfo _current;

    public PairingService(IOptions<PrintAgentSettings> settings, ILogger<PairingService> logger)
    {
        _logger = logger;
        _filePath = settings.Value.ResolvedPairingFilePath;
        _current = Load() ?? Generate();
        Save(_current);
    }

    public PairingInfo Current
    {
        get { lock (_lock) { return Clone(_current); } }
    }

    public bool IsPaired
    {
        get { lock (_lock) { return _current.IsPaired; } }
    }

    public PairingInfo GetOrCreate()
    {
        lock (_lock)
        {
            return Clone(_current);
        }
    }

    public void CompletePairing(string origin)
    {
        lock (_lock)
        {
            _current.Origin = origin;
            _current.PairedAt = DateTimeOffset.UtcNow;
            Save(_current);
            _logger.LogInformation("Agent paired with origin {Origin}", origin);
        }
    }

    public void Reset()
    {
        lock (_lock)
        {
            _current = Generate();
            Save(_current);
            _logger.LogWarning("Pairing reset; a new pairing code was generated");
        }
    }

    private static PairingInfo Generate()
    {
        var secretBytes = RandomNumberGenerator.GetBytes(32);
        var pairingId = RandomNumberGenerator.GetInt32(100_000, 999_999).ToString();
        return new PairingInfo
        {
            PairingId = pairingId,
            Secret = Convert.ToBase64String(secretBytes),
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    private PairingInfo? Load()
    {
        try
        {
            if (!File.Exists(_filePath)) return null;
            var json = File.ReadAllText(_filePath);
            return JsonSerializer.Deserialize<PairingInfo>(json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load pairing file at {Path}", _filePath);
            return null;
        }
    }

    private void Save(PairingInfo info)
    {
        try
        {
            var dir = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(_filePath, JsonSerializer.Serialize(info, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save pairing file at {Path}", _filePath);
        }
    }

    private static PairingInfo Clone(PairingInfo p) => new()
    {
        PairingId = p.PairingId,
        Secret = p.Secret,
        Origin = p.Origin,
        CreatedAt = p.CreatedAt,
        PairedAt = p.PairedAt
    };
}
