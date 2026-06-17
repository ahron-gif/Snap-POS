// =============================================================================
// LicenseClient.cs
//
// Drop-in HTTP client for the BackOffice-Web device-license API. Designed for
// desktop / Windows apps (POS, Back Office). Each app should:
//
//   1. Call EnforceAtStartupAsync() AFTER login but BEFORE showing the main UI.
//      If it returns false, exit / lock the app.
//   2. Start StartHeartbeat() to keep LastLoginDate fresh and re-check the slot.
//
// Server contract (lives in BackOffice.Api / UsageController):
//
//   POST /api/Usage/RegisterDevice
//     Auth: Bearer <user JWT>  (CustomerId comes from claims)
//     Body: { appId, advancedUId, deviceName }
//     200 : { isSuccess, response: {
//              allowed, reason, slotsTotal, slotsUsed, deviceId, isNewDevice
//            } }
//
// VB.NET projects: build this file as a small C# class library and reference
// the resulting DLL, or port the few dozen lines to VB. The HTTP shape and the
// fingerprint logic don't change.
// =============================================================================

#nullable enable
using System;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Rdt.LicenseClient
{
    /// <summary>App identifiers — must match dbo.Apps.AppId on the server.</summary>
    public static class AppIds
    {
        public const int WebApp        = 1;   // not used by desktop clients (per-user, login-gated)
        public const int PosTerminals  = 2;
        public const int PickingDevices = 3;  // a.k.a. Shipscan
        public const int PriceCheckers = 4;
    }

    /// <summary>What the client wants to do when the API is unreachable.</summary>
    public enum OfflinePolicy
    {
        /// <summary>Block on first call if API is down. Heartbeat failures still allow running.</summary>
        Strict = 0,
        /// <summary>Allow up to LenientWindowHours after the last successful allow.</summary>
        Lenient = 1,
    }

    public sealed class LicenseClientOptions
    {
        public required string ApiBaseUrl { get; init; }     // e.g. "https://api.rdt.com"

        /// <summary>
        /// Customer-level API key. Maps to <c>dbo.Customers.LicenseKey</c> on the
        /// server. Treat as a long-lived secret per tenant — embed in installer
        /// config or environment, never bundle in source. Rotate via super-admin
        /// if compromised.
        /// </summary>
        public required Guid LicenseKey { get; init; }

        public required int AppId { get; init; }
        public string? DeviceName { get; init; } = Environment.MachineName;
        public OfflinePolicy OfflinePolicy { get; init; } = OfflinePolicy.Strict;
        public int LenientWindowHours { get; init; } = 24;
        public TimeSpan HeartbeatInterval { get; init; } = TimeSpan.FromMinutes(15);
    }

    public sealed class RegisterDeviceResult
    {
        public bool Allowed { get; init; }
        public string? Reason { get; init; }
        public int SlotsTotal { get; init; }
        public int SlotsUsed { get; init; }
        public int? DeviceId { get; init; }
        public int? LicenseId { get; init; }
        public bool IsNewDevice { get; init; }

        public static RegisterDeviceResult Denied(string reason) =>
            new() { Allowed = false, Reason = reason };
    }

    public sealed class LicenseClient : IDisposable
    {
        private readonly LicenseClientOptions _opts;
        private readonly HttpClient _http;
        private readonly string _fingerprint;
        private CancellationTokenSource? _heartbeatCts;
        private DateTime _lastSuccessUtc = DateTime.MinValue;

        public LicenseClient(LicenseClientOptions options, HttpClient? http = null)
        {
            _opts = options ?? throw new ArgumentNullException(nameof(options));
            _http = http ?? new HttpClient { BaseAddress = new Uri(options.ApiBaseUrl) };
            if (_http.BaseAddress == null) _http.BaseAddress = new Uri(options.ApiBaseUrl);
            _fingerprint = DeviceFingerprint.Compute();
        }

        public string DeviceFingerprintHex => _fingerprint;

        /// <summary>
        /// Call once at startup, after login, before the main UI shows.
        /// Returns the server's Allowed/Reason so the caller can show a blocking
        /// message and exit if false.
        /// </summary>
        public async Task<RegisterDeviceResult> EnforceAtStartupAsync(CancellationToken ct = default)
        {
            try
            {
                var result = await CallRegisterAsync(ct).ConfigureAwait(false);
                if (result.Allowed)
                    _lastSuccessUtc = DateTime.UtcNow;
                return result;
            }
            catch (Exception ex)
            {
                Trace.WriteLine($"[LicenseClient] EnforceAtStartupAsync failed: {ex.Message}");
                return ApplyOfflinePolicy(ex);
            }
        }

        /// <summary>
        /// Spawns a background loop that hits RegisterDevice every HeartbeatInterval.
        /// Each tick refreshes LastLoginDate on the server. If the server returns
        /// Allowed=false on a heartbeat, onLicenseLost is invoked (e.g. log the
        /// user out, show a banner). Network failures during heartbeat do NOT
        /// invoke onLicenseLost — only an explicit Allowed=false from the API.
        /// </summary>
        public void StartHeartbeat(Action<RegisterDeviceResult>? onLicenseLost = null)
        {
            StopHeartbeat();
            _heartbeatCts = new CancellationTokenSource();
            var token = _heartbeatCts.Token;

            _ = Task.Run(async () =>
            {
                while (!token.IsCancellationRequested)
                {
                    try
                    {
                        await Task.Delay(_opts.HeartbeatInterval, token).ConfigureAwait(false);
                        var res = await CallRegisterAsync(token).ConfigureAwait(false);
                        if (res.Allowed)
                            _lastSuccessUtc = DateTime.UtcNow;
                        else
                            onLicenseLost?.Invoke(res);
                    }
                    catch (OperationCanceledException) { /* shutdown */ }
                    catch (Exception ex)
                    {
                        // Network blip — never invoke onLicenseLost; just log.
                        Trace.WriteLine($"[LicenseClient] Heartbeat failed: {ex.Message}");
                    }
                }
            }, token);
        }

        public void StopHeartbeat()
        {
            _heartbeatCts?.Cancel();
            _heartbeatCts?.Dispose();
            _heartbeatCts = null;
        }

        private async Task<RegisterDeviceResult> CallRegisterAsync(CancellationToken ct)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, "/api/DeviceLicense/Register")
            {
                Content = JsonContent.Create(new
                {
                    appId = _opts.AppId,
                    advancedUId = _fingerprint,
                    deviceName = _opts.DeviceName,
                }),
            };
            // Tenant-level auth — no per-user JWT needed. Server resolves
            // CustomerId from this key via dbo.Customers.LicenseKey.
            req.Headers.Add("X-Api-Key", _opts.LicenseKey.ToString());

            using var resp = await _http.SendAsync(req, ct).ConfigureAwait(false);
            resp.EnsureSuccessStatusCode();

            var envelope = await resp.Content
                .ReadFromJsonAsync<ApiEnvelope<RegisterDeviceResult>>(cancellationToken: ct)
                .ConfigureAwait(false);

            if (envelope?.Response == null)
                return RegisterDeviceResult.Denied(envelope?.Message ?? "Empty server response.");

            return envelope.Response;
        }

        private RegisterDeviceResult ApplyOfflinePolicy(Exception ex)
        {
            if (_opts.OfflinePolicy == OfflinePolicy.Lenient)
            {
                var withinWindow = DateTime.UtcNow - _lastSuccessUtc < TimeSpan.FromHours(_opts.LenientWindowHours);
                if (withinWindow)
                    return new RegisterDeviceResult
                    {
                        Allowed = true,
                        Reason = "Cached allow (server unreachable).",
                    };
            }
            return RegisterDeviceResult.Denied($"License server unreachable: {ex.Message}");
        }

        public void Dispose() => StopHeartbeat();

        private sealed class ApiEnvelope<T>
        {
            public bool IsSuccess { get; set; }
            public string? Message { get; set; }
            public T? Response { get; set; }
        }
    }

    /// <summary>
    /// Stable, hardware-derived device fingerprint. Survives reboots and reinstalls.
    /// Combines: motherboard serial + CPU id + first non-loopback MAC. SHA-256 hex.
    /// </summary>
    public static class DeviceFingerprint
    {
        public static string Compute()
        {
            var sb = new StringBuilder();
            sb.Append(SafeWmi("Win32_BaseBoard", "SerialNumber"));
            sb.Append('|');
            sb.Append(SafeWmi("Win32_Processor", "ProcessorId"));
            sb.Append('|');
            sb.Append(FirstPhysicalMac());

            using var sha = SHA256.Create();
            var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString()));
            return Convert.ToHexString(hash);
        }

        private static string SafeWmi(string cls, string prop)
        {
            try
            {
                using var searcher = new ManagementObjectSearcher($"SELECT {prop} FROM {cls}");
                foreach (var mo in searcher.Get())
                    return mo[prop]?.ToString() ?? "";
            }
            catch { /* ignored — return empty so the hash still varies on other inputs */ }
            return "";
        }

        private static string FirstPhysicalMac()
        {
            try
            {
                foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                    if (nic.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
                    var mac = nic.GetPhysicalAddress()?.ToString();
                    if (!string.IsNullOrEmpty(mac)) return mac;
                }
            }
            catch { /* ignored */ }
            return "";
        }
    }
}
