# Script: run-tests.ps1
# Does: Starts isolated test Postgres, runs backend API tests on host Go toolchain, then tears test DB down.
# Use: .\run-tests.ps1 [-KeepDb]
# DB: devbits_test (from backend/.env.test or defaults) in compose project devbits-test-local.
# Ports: test DB mapped to :5432 by docker-compose.test.yml.
# Modes: Frontend=OFF | Backend=tests only (no live deployment changes) | Live stack untouched | Test DB only.

param(
    [switch]$KeepDb
)

$ErrorActionPreference = "Stop"
$composeProject = "devbits-test-local"

Write-Host "=== DevBits Test Suite ===" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Resolve-Path (Join-Path $scriptDir "backend")
Push-Location $backendDir
try {
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
        Write-Host "Error: Docker is not installed. Please install Docker first." -ForegroundColor Red
        exit 1
    }

    $envTestFile = Join-Path $backendDir ".env.test"
    if (Test-Path $envTestFile) {
        Write-Host "Loading environment from .env.test..." -ForegroundColor Yellow
        Get-Content $envTestFile | Where-Object { $_ -notmatch '^#' -and $_ -match '=' } | ForEach-Object {
            $key, $value = $_ -split '=', 2
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    else {
        Write-Host "Warning: .env.test not found. Using default test environment values." -ForegroundColor Yellow
        [Environment]::SetEnvironmentVariable("POSTGRES_TEST_DB", "devbits_test", "Process")
        [Environment]::SetEnvironmentVariable("POSTGRES_TEST_USER", "testuser", "Process")
        [Environment]::SetEnvironmentVariable("POSTGRES_TEST_PASSWORD", "testpass123", "Process")
    }

    [Environment]::SetEnvironmentVariable("USE_TEST_DB", "true", "Process")

    $envTestFile = Join-Path $backendDir ".env.test"
    $testDbRunning = docker compose -p $composeProject -f docker-compose.test.yml --env-file $envTestFile ps 2>$null | Select-String "Up" -Quiet
    if (-not $testDbRunning) {
        Write-Host "Starting test database..." -ForegroundColor Yellow
        docker compose -p $composeProject -f docker-compose.test.yml --env-file $envTestFile up -d

        Write-Host "Waiting for database to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5

        $maxAttempts = 30
        $attempt = 0
        while ($attempt -lt $maxAttempts) {
            docker compose -p $composeProject -f docker-compose.test.yml --env-file $envTestFile exec -T test-db pg_isready -U testuser -d devbits_test 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Database is ready!" -ForegroundColor Green
                break
            }
            $attempt++
            Write-Host "Waiting for database... ($attempt/$maxAttempts)" -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }

        if ($attempt -eq $maxAttempts) {
            Write-Host "Error: Database failed to start within timeout" -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "Test database is already running." -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Running tests..." -ForegroundColor Cyan
    Write-Host ""

    go test -v ./api/internal/tests/...
    $testResult = $LASTEXITCODE

    Write-Host ""
    if ($testResult -eq 0) {
        Write-Host "All tests passed!" -ForegroundColor Green
    }
    else {
        Write-Host "Tests failed!" -ForegroundColor Red
    }

    if (-not $KeepDb) {
        Write-Host ""
        Write-Host "Stopping test database..." -ForegroundColor Yellow
        docker compose -p $composeProject -f docker-compose.test.yml down
    }
    else {
        Write-Host ""
        Write-Host "Test database is still running." -ForegroundColor Yellow
        Write-Host "Run 'docker compose -p $composeProject -f docker-compose.test.yml down' to stop it." -ForegroundColor Yellow
    }

    exit $testResult
}
finally {
    Pop-Location
}
