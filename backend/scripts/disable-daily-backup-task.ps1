param(
    [string]$TaskName = "DevBitsDailyDbBackup",
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = "& '" + $myinvocation.mycommand.definition + "'"
    Start-Process powershell -Verb runAs -ArgumentList $arguments
    exit
}

Write-Host "Removing scheduled task '$TaskName'..." -ForegroundColor Yellow

schtasks /Delete /F /TN $TaskName | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "Failed to remove scheduled task '$TaskName'."
}

Write-Host "Task removed." -ForegroundColor Green

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
Write-Host "Action: Daily backup task removed"
Write-Host "Updated: Windows scheduled task '$TaskName' deleted"
Write-Host "Live backend: $liveBackendState"

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
