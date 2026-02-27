# Script: run-db-tests.ps1
# Does: Recreates isolated local dev DB/backend containers, waits for DB, then runs Go tests in a temporary golang container.
# Use: .\run-db-tests.ps1
# DB: devbits_dev via host.docker.internal in compose project devbits-dev-local.
# Ports: backend default :8080, DB default :5433 (DEVBITS_BACKEND_PORT / DEVBITS_DB_PORT override).
# Modes: Frontend=OFF | Backend=only for local test infra | Live stack untouched | Dev/Test data isolated.

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

Push-Location $scriptDir
try {
    docker compose -p $composeProject -f backend/docker-compose.dev.yml down --volumes --remove-orphans
    docker compose -p $composeProject -f backend/docker-compose.dev.yml up -d --build

    Write-Host "Waiting for database readiness..." -ForegroundColor Yellow
    for ($i = 1; $i -le 60; $i++) {
        docker compose -p $composeProject -f backend/docker-compose.dev.yml exec -T db pg_isready -U devbits_dev -d devbits_dev *> $null
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

    $backendPath = Join-Path $scriptDir "backend"
    docker run --rm --add-host=host.docker.internal:host-gateway `
        -e USE_TEST_DB=true `
        -e POSTGRES_TEST_DB=devbits_dev `
        -e POSTGRES_TEST_USER=devbits_dev `
        -e POSTGRES_TEST_PASSWORD=devbits_dev_password `
        -e POSTGRES_TEST_HOST=host.docker.internal `
        -e POSTGRES_TEST_PORT=$dbPort `
        -v "${backendPath}:/app" -w /app/api golang:1.24 bash -c "go test ./..."
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}