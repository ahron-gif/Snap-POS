#Requires -RunAsAdministrator
param(
    [string]$ServiceName = "BackOfficePrintAgent",
    [switch]$PurgeData
)

$ErrorActionPreference = "Stop"

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $existing) {
    Write-Host "Service '$ServiceName' is not installed." -ForegroundColor Yellow
} else {
    Write-Host "==> Stopping and removing service '$ServiceName'..." -ForegroundColor Cyan
    if ($existing.Status -ne "Stopped") {
        Stop-Service -Name $ServiceName -Force
    }
    & sc.exe delete $ServiceName | Out-Null
    Write-Host "    Service removed." -ForegroundColor Green
}

if ($PurgeData) {
    $dataDir = Join-Path $env:ProgramData "BackOfficePrintAgent"
    if (Test-Path $dataDir) {
        Write-Host "==> Removing data directory $dataDir" -ForegroundColor Yellow
        Remove-Item -Recurse -Force $dataDir
    }
    try {
        if ([System.Diagnostics.EventLog]::SourceExists("BackOfficePrintAgent")) {
            Remove-EventLog -Source "BackOfficePrintAgent"
        }
    } catch {}
}
