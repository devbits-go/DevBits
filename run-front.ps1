param(
    [string]$ApiUrl = "",
    [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"

$apiPort = $env:API_PORT
if ([string]::IsNullOrWhiteSpace($apiPort)) {
    $apiPort = "8080"
}

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress

    if ([string]::IsNullOrWhiteSpace($lanIp)) {
        $lanIp = "localhost"
    }

    $ApiUrl = "http://$lanIp`:$apiPort"
}

Write-Host "=== DevBits Local Development Environment ===" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1/4: Checking for production Docker containers on port $apiPort..." -ForegroundColor Yellow
$prodRunning = docker compose -f "$backendDir\docker-compose.yml" ps backend 2>$null | Select-String "Up" -Quiet
if ($prodRunning) {
    Write-Host "Stopping production Docker containers (to free port $apiPort)..." -ForegroundColor Yellow
    docker compose -f "$backendDir\docker-compose.yml" down 2>$null
    $script:ProdDbStopped = $true
    Write-Host "Production containers stopped." -ForegroundColor Green
}
else {
    Write-Host "No production containers running on port $apiPort." -ForegroundColor Green
}
Write-Host ""

Write-Host "Step 2/4: Starting test database..." -ForegroundColor Yellow
docker compose -f "$backendDir\docker-compose.test.yml" up -d 2>$null
$script:TestDbStarted = $true

Write-Host "Waiting for test database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$maxAttempts = 15
$attempt = 0
while ($attempt -lt $maxAttempts) {
    $result = docker compose -f "$backendDir\docker-compose.test.yml" exec -T test-db pg_isready -U testuser -d devbits_test 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Test database is ready!" -ForegroundColor Green
        break
    }
    $attempt++
    Write-Host "Waiting for database... ($attempt/$maxAttempts)" -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

if ($attempt -eq $maxAttempts) {
    Write-Host "Warning: Test database may not be ready, continuing anyway..." -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Step 3/4: Starting local backend..." -ForegroundColor Yellow

$envTestFile = Join-Path $backendDir ".env.test"
if (Test-Path $envTestFile) {
    Get-Content $envTestFile | Where-Object { $_ -notmatch '^#' -and $_ -match '=' } | ForEach-Object {
        $key, $value = $_ -split '=', 2
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}
[Environment]::SetEnvironmentVariable("USE_TEST_DB", "true", "Process")

$backendProcess = Start-Process powershell -WorkingDirectory $backendDir -PassThru -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; go run ./api"
$script:BackendPid = $backendProcess.Id
Write-Host "Backend started (PID: $script:BackendPid)" -ForegroundColor Green
Write-Host "Waiting for backend to be ready..."
Start-Sleep -Seconds 3
Write-Host ""

Write-Host "Step 4/4: Starting frontend..." -ForegroundColor Yellow
Write-Host ""

$frontendProcess = Start-Process powershell -WorkingDirectory "$root\frontend" -PassThru -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; `$env:EXPO_PUBLIC_USE_LOCAL_API='1'; `$env:EXPO_PUBLIC_API_URL='$ApiUrl'; `$env:EXPO_PUBLIC_API_FALLBACK_URL='$ApiUrl'; npm run frontend"
$script:FrontendPid = $frontendProcess.Id

Write-Host ""
Write-Host "=== Local Development Environment Running ===" -ForegroundColor Green
Write-Host "Backend:   http://localhost:$apiPort" -ForegroundColor Cyan
Write-Host "Frontend:  Scan QR code with Expo Go" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services and restore production Docker containers." -ForegroundColor Yellow
Write-Host ""

function On-ScriptEnd {
    Write-Host ""
    Write-Host "=== Shutting down local development environment ===" -ForegroundColor Yellow
    
    if ($script:BackendPid) {
        Stop-Process -Id $script:BackendPid -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped backend (PID: $script:BackendPid)" -ForegroundColor Green
    }
    
    if ($script:FrontendPid) {
        Stop-Process -Id $script:FrontendPid -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped frontend" -ForegroundColor Green
    }
    
    if ($script:TestDbStarted) {
        Write-Host "Stopping test database..." -ForegroundColor Yellow
        docker compose -f "$backendDir\docker-compose.test.yml" down 2>$null
        Write-Host "Stopped test database" -ForegroundColor Green
    }
    
    if ($script:ProdDbStopped) {
        Write-Host "Restarting production Docker containers..." -ForegroundColor Yellow
        docker compose -f "$backendDir\docker-compose.yml" start 2>$null
        Write-Host "Production containers restarted" -ForegroundColor Green
    }
    
    Write-Host "Cleanup complete." -ForegroundColor Green
}

$null = [Console]::TreatControlCAsInput

try {
    while ($true) {
        Start-Sleep -Milliseconds 100
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.Key -eq [ConsoleKey]::C -and $key.Modifiers -eq [ConsoleModifiers]::Control) {
                On-ScriptEnd
                break
            }
        }
        if ($script:BackendPid -and (Get-Process -Id $script:BackendPid -ErrorAction SilentlyContinue)) {
        }
        else {
            On-ScriptEnd
            break
        }
    }
}
finally {
    On-ScriptEnd
}
