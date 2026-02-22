param(
    [string]$TaskName = "DevBitsDailyDbBackup",
    [string]$RunAt = "03:00",
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "backup-deployment-db.ps1"
if (-not (Test-Path $scriptPath)) {
    throw "Backup script not found: $scriptPath"
}

$psExe = (Get-Command powershell.exe -ErrorAction Stop).Source
$taskAction = "`"$psExe`" -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

Write-Host "Registering Windows scheduled task '$TaskName' to run daily at $RunAt..." -ForegroundColor Yellow

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = "& '" + $myinvocation.mycommand.definition + "'"
    Start-Process powershell -Verb runAs -ArgumentList $arguments
    exit
}

schtasks /Create /F /SC DAILY /TN $TaskName /TR $taskAction /ST $RunAt /RU SYSTEM /RL HIGHEST | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Warning "SYSTEM task creation failed (likely non-admin shell). Falling back to current user mode."
    schtasks /Create /F /SC DAILY /TN $TaskName /TR $taskAction /ST $RunAt | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create scheduled task in both SYSTEM and current-user modes."
    }
    Write-Warning "Task created in current user mode (Interactive only). Run this script as Administrator to use SYSTEM mode."
}

Write-Host "Task created successfully." -ForegroundColor Green
Write-Host "Verify with: schtasks /Query /TN $TaskName /V /FO LIST" -ForegroundColor Green

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")
$liveBackendState = "unavailable"
try {
    $statusOutput = docker compose -f (Join-Path $root "docker-compose.yml") ps backend 2>$null
    if ($LASTEXITCODE -eq 0) {
        $liveBackendState = if (($statusOutput | Out-String) -match "Up") { "running" } else { "not running" }
    }
}
catch {}

Write-Host ""
Write-Host "===== Summary =====" -ForegroundColor Cyan
Write-Host "Action: Daily backup task configured"
Write-Host "Updated: Scheduled task '$TaskName' set to run at $RunAt"
Write-Host "Live backend: $liveBackendState"

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
