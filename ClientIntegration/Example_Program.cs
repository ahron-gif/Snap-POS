// =============================================================================
// Example_Program.cs
//
// Reference integration. Drop into the POS / Back Office app's Program.cs (or
// equivalent main-entry file) and adapt the marked lines.
//
// This file is illustrative — it is NOT meant to compile inside the
// BackOffice-Web solution. Paste into the desktop app's project, then:
//   * Replace ApiBaseUrl with your environment's value
//   * Wire GetBearerTokenAsync to wherever the desktop app stores the JWT
//     (likely the same place it reads it for other API calls)
//   * Set AppId via AppIds.PosTerminals / PickingDevices / PriceCheckers
// =============================================================================

#nullable enable
using System;
using System.Threading.Tasks;
using System.Windows.Forms;
using Rdt.LicenseClient;

internal static class ExampleProgram
{
    [STAThread]
    private static async Task<int> Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        // 1. Read the customer-level license key from your installer config /
        //    environment / encrypted appsettings. NEVER bundle it in source.
        var licenseKey = ReadLicenseKeyFromConfig();

        // 2. Build the license client.
        using var license = new LicenseClient(new LicenseClientOptions
        {
            ApiBaseUrl = "https://api.rdt.example",                 // <-- env-specific
            LicenseKey = licenseKey,                                // <-- dbo.Customers.LicenseKey
            AppId = AppIds.PosTerminals,                            // <-- per app
            DeviceName = Environment.MachineName,
            OfflinePolicy = OfflinePolicy.Strict,
            HeartbeatInterval = TimeSpan.FromMinutes(15),
        });

        // 3. Block startup if the slot can't be claimed.
        var startup = await license.EnforceAtStartupAsync();
        if (!startup.Allowed)
        {
            MessageBox.Show(
                startup.Reason ?? "License check failed.",
                "RDT — License Required",
                MessageBoxButtons.OK,
                MessageBoxIcon.Stop);
            return 2; // non-zero exit so installers / launchers know
        }

        // 4. Keep the slot fresh while the app is running. If the server later
        //    returns Allowed=false (e.g. admin removed the license), fire the
        //    callback — typically force-logout or show a persistent banner.
        license.StartHeartbeat(onLicenseLost: result =>
        {
            // Marshal back to UI thread before showing UI
            ShowLicenseLostBanner(result.Reason ?? "License revoked.");
        });

        Application.Run(new MainForm());
        return 0;
    }

    // --- stubs for illustration only ---
    private static Guid ReadLicenseKeyFromConfig()
    {
        // Replace with your actual config reader. Suggestions:
        //   * Encrypted appsettings entry
        //   * DPAPI-protected file in %ProgramData%
        //   * Registry value under HKLM (machine-scoped)
        // Avoid embedding in source / the installer image; ship a placeholder
        // and have the installer prompt for the key during first run.
        return Guid.Parse(Environment.GetEnvironmentVariable("RDT_LICENSE_KEY") ?? Guid.Empty.ToString());
    }

    private static void ShowLicenseLostBanner(string reason) { /* your UI */ }
    private sealed class MainForm : Form { }
}
