param(
    [string]$Configuration = "Release",
    [string]$Version = "0.1.0",
    [string]$OutputDir = "publish",
    [switch]$Sign,
    [string]$SignThumbprint = "",
    [string]$SumatraUrl = "https://www.sumatrapdfreader.org/dl/rel/3.5.2/SumatraPDF-3.5.2-64.zip",
    [switch]$BuildInstaller,
    [string]$IsccPath = ""
)

$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectDir
$publishOut = Join-Path $projectDir $OutputDir
$serviceName = "BackOfficePrintAgent"

Write-Host "==> Publishing BackOffice Print Agent v$Version" -ForegroundColor Cyan

$svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
$serviceWasRunning = $false
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "==> Detected running '$serviceName' service - stopping it (locks the EXE)" -ForegroundColor Yellow
    try {
        Stop-Service -Name $serviceName -Force -ErrorAction Stop
        $serviceWasRunning = $true
        Start-Sleep -Seconds 2
    } catch {
        $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
        if (-not $isAdmin) {
            throw "The '$serviceName' service is running and locks the EXE. Re-run this script in an Administrator PowerShell, or stop the service first: 'Stop-Service $serviceName' (admin)."
        }
        throw "Failed to stop '$serviceName': $_"
    }
}

if (Test-Path $publishOut) {
    try {
        Remove-Item -Recurse -Force $publishOut
    } catch {
        throw "Could not remove '$publishOut'. Another process may have files open. Close any explorer windows or running EXEs from that folder, then retry. Underlying error: $_"
    }
}

dotnet publish "$projectDir/BackOffice.PrintAgent.csproj" `
    -c $Configuration `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:Version=$Version `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -o $publishOut

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed"
}

Write-Host "==> Output: $publishOut" -ForegroundColor Green

Write-Host "==> Bundling SumatraPDF (headless PDF printer for Session 0)" -ForegroundColor Cyan
$sumatraTarget = Join-Path $publishOut "SumatraPDF.exe"
$tempZip = Join-Path $env:TEMP ("sumatra-" + [guid]::NewGuid().ToString("N") + ".zip")
$tempExtract = Join-Path $env:TEMP ("sumatra-extract-" + [guid]::NewGuid().ToString("N"))
try {
    Invoke-WebRequest -Uri $SumatraUrl -OutFile $tempZip -UseBasicParsing
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
    $extractedExe = Get-ChildItem -Path $tempExtract -Recurse -Filter "SumatraPDF*.exe" | Select-Object -First 1
    if (-not $extractedExe) { throw "SumatraPDF.exe not found in archive." }
    Copy-Item $extractedExe.FullName $sumatraTarget -Force
    Write-Host "    Bundled: $sumatraTarget ($([math]::Round((Get-Item $sumatraTarget).Length / 1MB, 1)) MB)" -ForegroundColor Green
} catch {
    Write-Host "    WARNING: Could not bundle SumatraPDF: $_" -ForegroundColor Yellow
    Write-Host "    PDF printing will fail when running as a Windows Service. Place SumatraPDF.exe in $publishOut manually." -ForegroundColor Yellow
} finally {
    if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
    if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
}

if ($Sign) {
    if (-not $SignThumbprint) {
        throw "Pass -SignThumbprint when using -Sign"
    }
    $exe = Join-Path $publishOut "BackOfficePrintAgent.exe"
    Write-Host "==> Signing $exe with cert $SignThumbprint" -ForegroundColor Cyan
    & signtool.exe sign /sha1 $SignThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /v $exe
    if ($LASTEXITCODE -ne 0) {
        throw "signtool failed"
    }
}

if ($BuildInstaller) {
    Write-Host "==> Compiling Inno Setup installer" -ForegroundColor Cyan

    if (-not $IsccPath) {
        $candidates = @(
            "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
            "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
            "${env:ProgramFiles(x86)}\Inno Setup 5\ISCC.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) { $IsccPath = $c; break }
        }
    }

    if (-not $IsccPath -or -not (Test-Path $IsccPath)) {
        throw "ISCC.exe not found. Install Inno Setup 6.x from https://jrsoftware.org/isdl.php or pass -IsccPath."
    }

    $iss = Join-Path $PSScriptRoot "BackOfficePrintAgent.iss"
    if (-not (Test-Path $iss)) {
        throw "Installer script not found: $iss"
    }

    $outputDirInstaller = Join-Path $PSScriptRoot "Output"
    & $IsccPath "/DMyAppVersion=$Version" "/O$outputDirInstaller" $iss
    if ($LASTEXITCODE -ne 0) {
        throw "ISCC failed (exit $LASTEXITCODE)"
    }

    $setupExe = Join-Path $outputDirInstaller "BackOfficePrintAgentSetup-$Version.exe"
    if (Test-Path $setupExe) {
        $sizeMb = [math]::Round((Get-Item $setupExe).Length / 1MB, 1)
        Write-Host "==> Installer: $setupExe ($sizeMb MB)" -ForegroundColor Green

        if ($Sign) {
            Write-Host "==> Signing installer with cert $SignThumbprint" -ForegroundColor Cyan
            & signtool.exe sign /sha1 $SignThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /v $setupExe
            if ($LASTEXITCODE -ne 0) { throw "signtool (installer) failed" }
        }
    }
}

Write-Host "==> Next steps:" -ForegroundColor Yellow
if ($BuildInstaller) {
    Write-Host "    1. Distribute Installer\Output\BackOfficePrintAgentSetup-$Version.exe to end users."
    Write-Host "    2. They double-click. Setup wizard handles uninstall of any prior version + install + service registration."
} else {
    Write-Host "    1. Re-run with -BuildInstaller to produce a Setup.exe (requires Inno Setup 6 installed)."
    Write-Host "    2. Or test the raw EXE locally with .\install-service.ps1 (admin shell)."
}

if ($serviceWasRunning) {
    Write-Host ""
    Write-Host "NOTE: The '$serviceName' service was stopped before publish and was NOT restarted." -ForegroundColor Yellow
    Write-Host "      Reinstall to pick up the new EXE: .\install-service.ps1 (admin shell)" -ForegroundColor Yellow
}
