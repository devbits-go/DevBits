<#
install-adb.ps1

Downloads Android Platform Tools (adb) and updates the current PowerShell session PATH.
Usage: run from an Administrator PowerShell:
  .\scripts\install-adb.ps1

This script does NOT permanently modify user PATH. To persist, follow the printed setx command.
#>
param(
    [string]$Url = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
    [switch]$NoPause
)

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = "& '" + $myinvocation.mycommand.definition + "'"
    Start-Process powershell -Verb runAs -ArgumentList $arguments
    exit
}

Write-Output "Downloading Android Platform-Tools from $Url"
$dest = Join-Path $PSScriptRoot 'platform-tools.zip'
try {
    Invoke-WebRequest -Uri $Url -OutFile $dest -UseBasicParsing -ErrorAction Stop
}
catch {
    Write-Error "Failed to download platform-tools: $_"
    exit 1
}

$extractDir = Join-Path $PSScriptRoot 'platform-tools'
if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir }

Write-Output "Extracting to $PSScriptRoot"
try {
    Expand-Archive -Path $dest -DestinationPath $PSScriptRoot -Force
}
catch {
    Write-Error "Failed to extract: $_"
    exit 1
}

# platform-tools folder is created next to script; locate it
$pt = Join-Path $PSScriptRoot 'platform-tools'
if (-not (Test-Path $pt)) {
    # some zips contain a top-level folder named 'platform-tools' already
    $pt = Get-ChildItem -Path $PSScriptRoot -Directory | Where-Object { $_.Name -like 'platform-tools*' } | Select-Object -First 1
    if ($pt) { $pt = $pt.FullName } else { Write-Error "platform-tools folder not found after extraction"; exit 1 }
}

# Add to current session PATH
$env:Path = "$pt;$env:Path"

Write-Output "adb installed at: $pt"
Write-Output "Current session PATH updated. Verify with: adb version"
Write-Output "To persist PATH for your user, run (adjust carefully):"
Write-Output "  setx PATH \"$pt; %PATH%\""
Write-Output "Done."

$liveBackendState = "unavailable"
try {
    $composeFile = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "backend\docker-compose.yml"
    $statusOutput = docker compose -f $composeFile ps backend 2>$null
    if ($LASTEXITCODE -eq 0) {
        $liveBackendState = if (($statusOutput | Out-String) -match "Up") { "running" } else { "not running" }
    }
}
catch {}

Write-Output ""
Write-Output "===== Summary ====="
Write-Output "Action: Android Platform Tools install/update executed"
Write-Output "Updated: adb binaries extracted and PATH updated for current session"
Write-Output "Live backend: $liveBackendState"

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
