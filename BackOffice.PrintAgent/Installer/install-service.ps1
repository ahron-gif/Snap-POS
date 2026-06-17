#Requires -RunAsAdministrator
param(
    [string]$ServiceName = "BackOfficePrintAgent",
    [string]$DisplayName = "BackOffice Print Agent",
    [string]$Description = "Local print helper for the BackOffice web application.",
    [string]$BinaryPath = "",
    [string]$RunAsUser = "",
    [System.Management.Automation.PSCredential]$RunAsCredential = $null
)

$ErrorActionPreference = "Stop"

function Grant-LogonAsServiceRight {
    param([string]$AccountName)
    $tempInf = Join-Path $env:TEMP ("svcrights-" + [guid]::NewGuid().ToString("N") + ".inf")
    $tempSdb = [System.IO.Path]::ChangeExtension($tempInf, ".sdb")
    try {
        $sid = (New-Object System.Security.Principal.NTAccount($AccountName)).Translate([System.Security.Principal.SecurityIdentifier]).Value
        $current = & secedit /export /areas USER_RIGHTS /cfg $tempInf | Out-Null
        $content = Get-Content $tempInf -Raw
        if ($content -match "SeServiceLogonRight\s*=\s*([^`r`n]+)") {
            $existing = $Matches[1]
            if ($existing -notmatch [regex]::Escape("*$sid")) {
                $content = $content -replace "SeServiceLogonRight\s*=\s*[^`r`n]+", "SeServiceLogonRight = $existing,*$sid"
            } else {
                Write-Host "    'Log on as a service' already granted to $AccountName" -ForegroundColor Gray
                return
            }
        } else {
            $content = $content -replace "(\[Privilege Rights\])", "`$1`r`nSeServiceLogonRight = *$sid"
        }
        Set-Content -Path $tempInf -Value $content -Encoding Unicode
        & secedit /configure /db $tempSdb /cfg $tempInf /areas USER_RIGHTS | Out-Null
        Write-Host "    Granted 'Log on as a service' to $AccountName" -ForegroundColor Gray
    } finally {
        if (Test-Path $tempInf) { Remove-Item $tempInf -Force }
        if (Test-Path $tempSdb) { Remove-Item $tempSdb -Force }
    }
}

if (-not $BinaryPath) {
    $scriptDir = Split-Path -Parent $PSScriptRoot
    $candidate = Join-Path $scriptDir "publish\BackOfficePrintAgent.exe"
    if (-not (Test-Path $candidate)) {
        $candidate = Join-Path $scriptDir "BackOfficePrintAgent.exe"
    }
    $BinaryPath = $candidate
}

if (-not (Test-Path $BinaryPath)) {
    throw "BackOfficePrintAgent.exe not found. Pass -BinaryPath or run publish.ps1 first."
}

$BinaryPath = (Resolve-Path $BinaryPath).Path
$BinaryDir = Split-Path -Parent $BinaryPath
Write-Host "==> Installing service '$ServiceName' from $BinaryPath" -ForegroundColor Cyan

$sumatraExe = Join-Path $BinaryDir "SumatraPDF.exe"
if (-not (Test-Path $sumatraExe)) {
    Write-Host "    SumatraPDF.exe missing - downloading (required for headless PDF printing as a service)..." -ForegroundColor Yellow
    $sumatraUrl = "https://www.sumatrapdfreader.org/dl/rel/3.5.2/SumatraPDF-3.5.2-64.zip"
    $tempZip = Join-Path $env:TEMP ("sumatra-" + [guid]::NewGuid().ToString("N") + ".zip")
    $tempExtract = Join-Path $env:TEMP ("sumatra-extract-" + [guid]::NewGuid().ToString("N"))
    try {
        Invoke-WebRequest -Uri $sumatraUrl -OutFile $tempZip -UseBasicParsing
        Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
        $extracted = Get-ChildItem -Path $tempExtract -Recurse -Filter "SumatraPDF*.exe" | Select-Object -First 1
        if (-not $extracted) { throw "SumatraPDF.exe not found inside archive." }
        Copy-Item $extracted.FullName $sumatraExe -Force
        Write-Host "    Bundled: $sumatraExe" -ForegroundColor Green
    } finally {
        if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
        if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
    }
} else {
    Write-Host "    SumatraPDF.exe present at $sumatraExe" -ForegroundColor Gray
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "    Stopping and removing existing service..." -ForegroundColor Yellow
    if ($existing.Status -ne "Stopped") {
        Stop-Service -Name $ServiceName -Force
    }
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

$quotedBinary = '"' + $BinaryPath + '"'

if ($RunAsUser) {
    if (-not $RunAsCredential) {
        $RunAsCredential = Get-Credential -UserName $RunAsUser -Message "Enter password for $RunAsUser (service account)"
    }
    if (-not $RunAsCredential) { throw "RunAsUser specified but no credential provided." }
    $accountName = $RunAsCredential.UserName
    if ($accountName -notmatch "[\\@]") { $accountName = ".\$accountName" }

    Grant-LogonAsServiceRight -AccountName $accountName

    $plain = $RunAsCredential.GetNetworkCredential().Password
    Write-Host "    Creating service to run as $accountName" -ForegroundColor Cyan
    & sc.exe create $ServiceName binPath= $quotedBinary start= auto DisplayName= $DisplayName obj= $accountName password= $plain
    $rc = $LASTEXITCODE
    $plain = $null
    [System.GC]::Collect()
    if ($rc -ne 0) { throw "sc create failed (exit $rc)" }
} else {
    & sc.exe create $ServiceName binPath= $quotedBinary start= auto DisplayName= $DisplayName obj= LocalSystem
    if ($LASTEXITCODE -ne 0) { throw "sc create failed (exit $LASTEXITCODE)" }
}

& sc.exe description $ServiceName $Description | Out-Null
& sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/15000/restart/60000 | Out-Null
& sc.exe failureflag $ServiceName 1 | Out-Null

$dataDir = Join-Path $env:ProgramData "BackOfficePrintAgent"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
}

if ($RunAsUser -and $RunAsCredential) {
    $acl = Get-Acl $dataDir
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $RunAsCredential.UserName, "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
    $acl.AddAccessRule($rule)
    Set-Acl -Path $dataDir -AclObject $acl
    Write-Host "    Granted Modify on $dataDir to $($RunAsCredential.UserName)" -ForegroundColor Gray
}

try {
    if (-not [System.Diagnostics.EventLog]::SourceExists("BackOfficePrintAgent")) {
        New-EventLog -LogName "Application" -Source "BackOfficePrintAgent"
    }
} catch {
    Write-Host "    Could not register event source: $_" -ForegroundColor Yellow
}

Start-Service -Name $ServiceName
Start-Sleep -Seconds 2
Get-Service -Name $ServiceName | Format-List Name, Status, StartType

Write-Host "==> Service installed and started." -ForegroundColor Green
Write-Host "    Logs: $dataDir\logs\" -ForegroundColor Gray
Write-Host "    Pairing file: $dataDir\pairing.json" -ForegroundColor Gray
