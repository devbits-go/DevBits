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

Write-Host ""
Write-Host "===== Summary =====" -ForegroundColor Cyan
Write-Host "Action: Daily backup task removed"
Write-Host "Updated: Windows scheduled task '$TaskName' deleted"
Write-Host "Execution target removed: backup-deployment-db.ps1"

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
