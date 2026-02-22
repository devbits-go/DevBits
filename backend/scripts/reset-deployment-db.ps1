param(
    [switch]$KeepUploads,
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

Write-Host "Resetting DevBits deployment database to a blank slate..." -ForegroundColor Yellow

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = "& '" + $myinvocation.mycommand.definition + "'"
    Start-Process powershell -Verb runAs -ArgumentList $arguments
    exit
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")
Push-Location $root
try {
    $envFile = Join-Path $root ".env"
    if (-not (Test-Path $envFile)) {
        throw "Missing $envFile. Create it from backend/.env.example and set strong credentials before resetting."
    }

    docker compose down -v --remove-orphans

    if (-not $KeepUploads) {
        $uploadsPath = Join-Path $root "uploads"
        if (Test-Path $uploadsPath) {
            Get-ChildItem -Path $uploadsPath -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    docker compose up -d --build

    Write-Host "Database reset complete. All users and app data are removed." -ForegroundColor Green
}
finally {
    Pop-Location
}

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
Write-Host "Action: Deployment DB reset executed"
Write-Host "Updated: Database recreated and services rebuilt"
Write-Host "Live backend: $liveBackendState"

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
