# Script: run-dev.ps1
# Does: Boots local dev DB + local backend (isolated compose project), then launches frontend in local mode.
# Use: .\run-dev.ps1 [-Clear]
# DB: devbits_dev (user/pass: devbits_dev/devbits_dev_password) in compose project devbits-dev-local.
# Ports: backend default :8080, DB default :5433 (DEVBITS_BACKEND_PORT / DEVBITS_DB_PORT override).
# Modes: Frontend=ON(local API) | Backend=ON(local Docker) | Live stack untouched | Test DB untouched.

param(
    [switch]$Clear
)

$ErrorActionPreference = "Stop"

function Test-PortInUse {
    param([int]$Port)

    try {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return $null -ne $listener
    }
    catch {
        return $false
    }
}

function Resolve-Port {
    param(
        [string]$Label,
        [int]$DefaultPort
    )

    $port = $DefaultPort
    while (Test-PortInUse -Port $port) {
        Write-Host "Port $port is already in use for $Label." -ForegroundColor Yellow
        $inputPort = Read-Host "Enter alternate port for $Label (blank to exit)"
        if ([string]::IsNullOrWhiteSpace($inputPort)) {
            Write-Host "Exiting. Free port $DefaultPort or choose an alternate port next run." -ForegroundColor Red
            exit 1
        }

        if (-not [int]::TryParse($inputPort, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
            Write-Host "Invalid port: $inputPort" -ForegroundColor Red
            $port = $DefaultPort
        }
    }

    return $port
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"
$composeProject = "devbits-dev-local"

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "Error: Docker is required." -ForegroundColor Red
    exit 1
}

docker compose version | Out-Null

$backendDefault = if ($env:DEVBITS_BACKEND_PORT -match '^\d+$') { [int]$env:DEVBITS_BACKEND_PORT } else { 8080 }
$dbDefault = if ($env:DEVBITS_DB_PORT -match '^\d+$') { [int]$env:DEVBITS_DB_PORT } else { 5433 }

$backendPort = Resolve-Port -Label "backend" -DefaultPort $backendDefault
$dbPort = Resolve-Port -Label "postgres" -DefaultPort $dbDefault

$env:DEVBITS_BACKEND_PORT = "$backendPort"
$env:DEVBITS_DB_PORT = "$dbPort"

Write-Host "Using backend port $backendPort and db port $dbPort." -ForegroundColor Cyan

Push-Location $backendDir
try {
    docker compose -p $composeProject -f docker-compose.dev.yml down --volumes --remove-orphans
    docker compose -p $composeProject -f docker-compose.dev.yml up -d --build

    Write-Host "Waiting for database readiness..." -ForegroundColor Yellow
    for ($i = 1; $i -le 60; $i++) {
        docker compose -p $composeProject -f docker-compose.dev.yml exec -T db pg_isready -U devbits_dev -d devbits_dev *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Database is ready." -ForegroundColor Green
            break
        }

        if ($i -eq 60) {
            Write-Host "Error: Database did not become ready within 60 seconds." -ForegroundColor Red
            exit 1
        }
        Start-Sleep -Seconds 1
    }

    Write-Host "Waiting for backend health check..." -ForegroundColor Yellow
    for ($i = 1; $i -le 60; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$backendPort/health" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Host "Backend is healthy." -ForegroundColor Green
                break
            }
        }
        catch {
        }

        if ($i -eq 60) {
            Write-Host "Error: Backend did not become healthy within 60 seconds." -ForegroundColor Red
            docker compose -p $composeProject -f docker-compose.dev.yml logs backend --tail 100
            exit 1
        }

        Start-Sleep -Seconds 1
    }
}
finally {
    Pop-Location
}

Write-Host "Launching frontend in local backend mode..." -ForegroundColor Cyan
$env:EXPO_PUBLIC_LOCAL_API_PORT = "$backendPort"
if ($Clear) {
    & (Join-Path $scriptDir "run-front.ps1") -Local -Clear
}
else {
    & (Join-Path $scriptDir "run-front.ps1") -Local
}
exit $LASTEXITCODE