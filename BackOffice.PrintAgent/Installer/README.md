# BackOffice Print Agent — Installer & Distribution

The Print Agent runs as a **Windows Service**. It auto-starts at boot, survives logoff/restart, and stores all state in `C:\ProgramData\BackOfficePrintAgent\`.

There are two install paths in this folder:

| Path | When to use |
|---|---|
| `BackOfficePrintAgentSetup-{version}.exe` (built from `BackOfficePrintAgent.iss`) | **End users.** Double-click. Wizard handles uninstall-of-prior-version + install + service registration + Add/Remove Programs entry. |
| `install-service.ps1` / `uninstall-service.ps1` | **Developers.** Quick iteration during development without rebuilding the installer. |

## ⚠️ When the SmartKart URL changes (e.g. QA → Prod, domain rename)

The SmartKart web origin is hard-coded in **two files**. When you point the agent at a new environment, both must change in lockstep — otherwise the agent will reject CORS requests, OR the desktop shortcut will open the wrong site, OR users will be sent through Chrome's loopback-permission prompt again.

### Step 1. Update the agent's CORS allowlist

File: [`../appsettings.json`](../appsettings.json)
Section: `Agent.AllowedOrigins`

```jsonc
"AllowedOrigins": [
  "http://localhost:5173",
  "https://localhost:5173",
  ...
  "https://YOUR-NEW-URL.smartkart.app"   // ← add / replace
]
```

You can list **multiple origins** here (QA + Prod + UAT). The agent accepts any of them.

### Step 2. Update the installer's URL define

File: [`BackOfficePrintAgent.iss`](BackOfficePrintAgent.iss)
Line near the top:

```inno
#define SmartKartUrl "https://YOUR-NEW-URL.smartkart.app"
```

This one `#define` drives:
- Desktop + Start Menu shortcut target
- The post-install "Open SmartKart now" launch button
- The Chrome / Edge enterprise policy URL the installer registers
- The uninstaller's cleanup of those policy entries

### Step 3. Rebuild and redistribute the installer

```powershell
.\publish.ps1 -BuildInstaller
```

Then ship the produced `Output\BackOfficePrintAgentSetup-{version}.exe` to all end-user PCs. The installer uninstalls the old version and installs the new one.

### What you do NOT need to touch

- **`LaunchSmartKart.vbs`** — has a hard-coded `DefaultUrl` constant, but it's only a fallback. The shortcut always passes the URL from `{#SmartKartUrl}` explicitly, so the constant never runs.
- **React web app code** — uses `window.location.origin` and self-adjusts.
- **Backend API code** — print agent endpoints don't care about the web app URL.

### Supporting multiple environments from one installer

If you want a single installer that allows both QA + Prod (or any combination):

1. Add **all** environment URLs to `Agent.AllowedOrigins` in `appsettings.json`.
2. In `BackOfficePrintAgent.iss`, edit `InstallBrowserPolicies()` and `RemoveBrowserPolicies()` to call `SetBrowserPolicyForOrigin` / `RemoveBrowserPolicyForOrigin` once per URL.
3. Pick **one** URL for the shortcut (`#define SmartKartUrl`) — that's the primary entry point users will click. The others remain accessible via direct navigation or extra shortcuts.

If you want two shortcuts (one for QA, one for Prod), copy the two entries in `[Icons]` and the entry in `[Run]`, and parameterize each with a different URL.

---

## PDF printing architecture

PDF rendering is **in-process** via PDFium (Chrome's PDF engine) embedded as a native library. This means:
- No external `.exe` shell-out for normal prints — faster, no process-spawn overhead.
- `PrintDocument` API drives the spooler directly; no temp files in the happy path.
- The published EXE is ~184 MB (PDFium native bundle adds ~110 MB).
- If PDFium fails on a malformed PDF, the agent falls back to **SumatraPDF.exe** (bundled), then Adobe Reader (if installed), then shell `printto`.

## Building the installer (`Setup.exe`)

### One-time setup

Install **Inno Setup 6.2+** (free, MIT-style license) from https://jrsoftware.org/isdl.php. Default install path is `C:\Program Files (x86)\Inno Setup 6\`.

### Build command

```powershell
.\publish.ps1 -Version 0.1.0 -BuildInstaller
```

What it does:
1. `dotnet publish` → `publish\BackOfficePrintAgent.exe` (~184 MB self-contained).
2. Auto-downloads SumatraPDF.exe → `publish\SumatraPDF.exe`.
3. (Optional `-Sign -SignThumbprint <thumbprint>`) signs the agent EXE.
4. Compiles `BackOfficePrintAgent.iss` via ISCC → `Installer\Output\BackOfficePrintAgentSetup-0.1.0.exe`.
5. (Optional `-Sign`) signs the installer EXE too.

You ship the `Setup.exe`. End users don't need PowerShell.

### What the installer does at runtime

1. Asks for admin elevation (UAC prompt).
2. Standard wizard: license, install location (default `C:\Program Files\BackOffice Print Agent`).
3. **Service Account page** — radio: "LocalSystem" or "Run as a specific user".
4. **Credentials page** (only if user-account chosen) — username + password fields. Username defaults to current user.
5. Stops + deletes any prior `BackOfficePrintAgent` service.
6. Copies files to `{app}` (Program Files).
7. Creates `C:\ProgramData\BackOfficePrintAgent\` and `\logs\` with `users-modify` permission.
8. Creates the service via `sc.exe`:
   - `start= auto`
   - `obj=` LocalSystem or the chosen user (with password handed only to SCM, never written to disk).
   - Recovery: `restart/5s, 15s, 60s` with 24h reset window.
9. If user-account: grants `SeServiceLogonRight` via `secedit` and `Modify` ACL on ProgramData via `icacls`.
10. Starts the service.
11. Registers in **Add/Remove Programs** for one-click uninstall.

### Uninstall

End users go to Settings → Apps → "BackOffice Print Agent" → Uninstall. The installer's `[Code]` block stops + deletes the service before removing files.

## Developer path (no installer rebuild)

If you're iterating on agent code and don't want to rebuild Setup.exe each time:

```powershell
# Publish only (no installer)
.\publish.ps1 -Version 0.1.0

# Install as LocalSystem (default)
.\install-service.ps1

# Install with user account (when testing per-user printers)
.\install-service.ps1 -RunAsUser "$env:USERDOMAIN\$env:USERNAME"

# Uninstall (keeps pairing + logs)
.\uninstall-service.ps1

# Uninstall and wipe %PROGRAMDATA%\BackOfficePrintAgent
.\uninstall-service.ps1 -PurgeData
```

### When to use `-RunAsUser`

Use it if any of these apply:
- Your printer name has a `(Copy 1)` suffix (signals a per-user install).
- The printer port starts with `DOT4_` (USB HP printers — driver requires user session).
- The printer is a network share (`\\server\printer`) that needs domain credentials.
- The agent reports `success: true` from `/print` but no physical output appears and the job is stuck in `Get-PrintJob`.

The user account must have the printer installed in *its* profile. For multi-machine rollouts, use a dedicated service account (e.g. `svc-printagent`) and install printers under it once.

## Production checklist (pre-release)

1. **Buy code-signing cert** (Sectigo OV or DigiCert OV, ~$400/yr). Allow 5–10 days issuance. Without a signed installer, SmartScreen will warn end users.
2. **Build + sign**:
   ```powershell
   .\publish.ps1 -Version 0.1.0 -BuildInstaller -Sign -SignThumbprint <thumbprint>
   ```
   Both `BackOfficePrintAgent.exe` and `BackOfficePrintAgentSetup-0.1.0.exe` get signed.
3. **Test on a clean Windows 10/11 VM** — see "Smoke test" below.
4. **Auto-update channel** (optional, for over-the-air updates):
   ```powershell
   dotnet tool install -g vpk
   vpk pack -u BackOfficePrintAgent -v 0.1.0 -p publish -e BackOfficePrintAgent.exe
   ```
   Upload `Releases\` to Azure Blob / S3 and wire `UpdateService` to the feed URL (currently a stub).

## Smoke test after building Setup.exe

1. Copy `BackOfficePrintAgentSetup-0.1.0.exe` to a clean Windows 10/11 VM. Double-click.
2. UAC → Yes. Setup wizard appears.
3. Pick "LocalSystem" for first install. Click Install. Should complete in ~10s.
4. `Get-Service BackOfficePrintAgent` → `Running`.
5. Open `https://localhost:9443/health` in a browser. (You may see a one-time cert warning if Edge/Chrome haven't refreshed the LocalMachine\Root store yet — accept and refresh.)
6. From the web app at `https://localhost:5173`, open Settings → Print Helper. Click **Pair this browser**.
7. Map a document type to an installed printer. Click **Test print**.
8. Restart the machine. Login. Without launching anything, the agent should already be running and paired.
9. Settings → Apps → BackOffice Print Agent → **Uninstall**. Verify service is gone, ProgramData remains (or is removed if uninstaller wipes it — your call to add that).
