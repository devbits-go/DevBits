param(
    [switch]$NoPause
)

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = "& '" + $myinvocation.mycommand.definition + "'"
    Start-Process powershell -Verb runAs -ArgumentList $arguments
    exit
}

$ErrorActionPreference = "Stop"

Write-Host "Updating the live application by rebuilding and restarting the backend service..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")
Push-Location $root

try {
    $envFile = Join-Path $root ".env"
    if (-not (Test-Path $envFile)) {
        throw "Missing $envFile. Create it from backend/.env.example and set strong credentials before deploying."
    }

    $envContent = Get-Content -Path $envFile -Raw
    if ($envContent -notmatch "(?m)^POSTGRES_PASSWORD=.+$") {
        throw "POSTGRES_PASSWORD is not set in $envFile."
    }
    if ($envContent -match "(?m)^POSTGRES_PASSWORD=(password|changeme|devbits)$") {
        throw "POSTGRES_PASSWORD in $envFile is weak/default. Set a strong random value before deploying."
    }

    # Ensure DB is started first so we can sync credentials to avoid auth mismatches.
    docker compose up -d db

    # Wait for DB health (up to ~60s)
    $dbHealthy = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $statusOutput = docker compose ps db 2>$null | Out-String
        if ($statusOutput -match "Up" -and $statusOutput -match "healthy") {
            $dbHealthy = $true
            break
        }
        Start-Sleep -Seconds 2
    }

    if (-not $dbHealthy) {
        Write-Host "Warning: DB did not reach healthy state in time; proceeding to attempt password sync anyway." -ForegroundColor Yellow
    }

    # Sync the POSTGRES_PASSWORD from .env into the Postgres role to keep credentials consistent.
    try {
        $envRaw = Get-Content -Path $envFile -Raw
        if ($envRaw -match "(?m)^POSTGRES_PASSWORD=(.+)$") {
            $dbPass = $Matches[1].Trim()
            if ($dbPass -and $dbPass -notmatch "^(password|changeme|devbits)$") {
                $tmpFile = Join-Path $env:TEMP "sync-devbits-password.sql"
                $safe = $dbPass.Replace("'", "''")
                Set-Content -Path $tmpFile -Value "ALTER ROLE devbits WITH PASSWORD '$safe';" -NoNewline
                try {
                    Get-Content $tmpFile -Raw | docker compose exec -T db sh -lc "psql -U devbits -d postgres" | Out-Null
                    Write-Host "Synchronized Postgres role password to match .env" -ForegroundColor Green
                }
                catch {
                    Write-Host "Warning: Could not run password sync command inside DB container: $_" -ForegroundColor Yellow
                }
                Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
    catch {
        Write-Host "Warning: Failed to read .env or sync password: $_" -ForegroundColor Yellow
    }

    docker compose up -d --build backend nginx
    Write-Host "Backend and nginx services have been updated." -ForegroundColor Green
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
Write-Host "Action: Live backend update executed"
Write-Host "Updated: Backend rebuilt; nginx refreshed"
Write-Host "Live backend: $liveBackendState"

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
