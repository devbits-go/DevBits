param(
    [ValidateSet("live", "local-clean", "local-existing")]
    [string]$Mode,
    [switch]$UseLocalBackend,
    [string]$ApiUrl = "https://devbits.ddns.net",
    [switch]$KeepBackend,
    [switch]$Rebuild,
    [switch]$NoStart,
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = "& '" + $myinvocation.mycommand.definition + "'"
    Start-Process powershell -Verb runAs -ArgumentList $arguments
    exit
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-RunMode {
    if ($Mode) {
        return $Mode
    }

    if ($UseLocalBackend -and $KeepBackend) {
        return "local-existing"
    }
    if ($UseLocalBackend) {
        return "local-clean"
    }

    Write-Host "Select backend mode:" -ForegroundColor Cyan
    Write-Host "  1) live          - connect frontend to deployed backend ($ApiUrl)"
    Write-Host "  2) local-clean   - reset local docker backend to blank-slate then run"
    Write-Host "  3) local-existing- use existing local docker backend without reset"

    $selection = Read-Host "Enter 1, 2, or 3 (default 1)"
    switch ($selection) {
        "2" { return "local-clean" }
        "3" { return "local-existing" }
        default { return "live" }
    }
}

function Test-BackendHealthy {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200 -and $response.Content -match "API is running") {
            return $true
        }
    }
    catch {
        # Will retry
    }
    return $false
}

function Resolve-AndroidSdkPath {
    $candidates = @()

    if ($env:ANDROID_HOME) {
        $candidates += $env:ANDROID_HOME
    }
    if ($env:ANDROID_SDK_ROOT) {
        $candidates += $env:ANDROID_SDK_ROOT
    }

    $candidates += "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
    $candidates += "C:\Users\$env:USERNAME\AppData\Local\Android\sdk"
    $candidates += "C:\Android\Sdk"
    $candidates += "C:\Android\sdk"

    $wingetPkgRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    if (Test-Path $wingetPkgRoot) {
        $platformToolPackages = Get-ChildItem $wingetPkgRoot -Directory -Filter "Google.PlatformTools*" -ErrorAction SilentlyContinue
        foreach ($pkg in $platformToolPackages) {
            $candidates += $pkg.FullName
        }
    }

    $uniqueCandidates = $candidates | Where-Object { $_ } | Select-Object -Unique

    foreach ($path in $uniqueCandidates) {
        $platformToolsPath = Join-Path $path "platform-tools"
        $emulatorPath = Join-Path $path "emulator\emulator.exe"
        if ((Test-Path (Join-Path $platformToolsPath "adb.exe")) -and (Test-Path $emulatorPath)) {
            return $path
        }
    }

    foreach ($path in $uniqueCandidates) {
        $platformToolsPath = Join-Path $path "platform-tools"
        if (Test-Path (Join-Path $platformToolsPath "adb.exe")) {
            return $path
        }
        if (Test-Path (Join-Path $path "adb.exe")) {
            return (Split-Path -Parent $path)
        }
    }

    return $null
}

function Add-ToPathIfMissing([string]$pathToAdd) {
    if ([string]::IsNullOrWhiteSpace($pathToAdd)) {
        return
    }
    $currentPath = $env:Path -split ';'
    if ($currentPath -contains $pathToAdd) {
        return
    }
    $env:Path = "$pathToAdd;$env:Path"
}

function Resolve-AndroidStudioPath {
    $candidates = @(
        "C:\Program Files\Android\Android Studio\bin\studio64.exe",
        "C:\Program Files (x86)\Android\Android Studio\bin\studio64.exe",
        "C:\Users\$env:USERNAME\AppData\Local\Android\Android Studio\bin\studio64.exe"
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) {
            return $path
        }
    }

    return $null
}

function Try-StartAndroidEmulator([string]$sdkPath) {
    if ([string]::IsNullOrWhiteSpace($sdkPath)) {
        return
    }

    $emulatorExe = Join-Path $sdkPath "emulator\emulator.exe"
    if (-not (Test-Path $emulatorExe)) {
        Write-Warning "Android emulator not installed in SDK. Open Android Studio > SDK Manager and install Emulator + system image."
        return
    }

    $avdList = & $emulatorExe -list-avds 2>$null
    if (-not $avdList -or $avdList.Count -eq 0) {
        Write-Warning "No Android Virtual Device (AVD) found. Open Android Studio > Device Manager and create one."
        return
    }

    $selectedAvd = $avdList[0]
    if ($selectedAvd) {
        Write-Host "Starting Android emulator: $selectedAvd" -ForegroundColor Yellow
        Start-Process $emulatorExe -ArgumentList "-avd", $selectedAvd
    }
}

$androidSdkPath = Resolve-AndroidSdkPath
$androidStudioPath = Resolve-AndroidStudioPath
if ($androidSdkPath) {
    $env:ANDROID_HOME = $androidSdkPath
    $env:ANDROID_SDK_ROOT = $androidSdkPath

    $platformTools = Join-Path $androidSdkPath "platform-tools"
    if (Test-Path $platformTools) {
        Add-ToPathIfMissing $platformTools
    }

    $emulatorPath = Join-Path $androidSdkPath "emulator"
    if (Test-Path $emulatorPath) {
        Add-ToPathIfMissing $emulatorPath
    }

    Write-Host "Android SDK: $androidSdkPath" -ForegroundColor Green
}
else {
    Write-Warning "Android SDK not found."
    Write-Warning "Run Android Studio once to complete SDK setup, then rerun this script."
    if ($androidStudioPath) {
        Write-Host "Launching Android Studio setup wizard..." -ForegroundColor Yellow
        Start-Process $androidStudioPath
    }
    else {
        Write-Warning "Android Studio missing. Install with: winget install --id Google.AndroidStudio --exact"
    }
}

function Wait-ForLocalBackendHealth {
    Write-Host "Waiting for local backend to become healthy..."
    $maxRetries = 15
    $retryInterval = 2
    $healthy = $false
    for ($i = 0; $i -lt $maxRetries; $i++) {
        if (Test-BackendHealthy) {
            $healthy = $true
            break
        }
        Start-Sleep -Seconds $retryInterval
    }

    if ($healthy) {
        Write-Host "Local backend is healthy at http://localhost/health" -ForegroundColor Green
    }
    else {
        Write-Warning "Local backend did not become healthy in time. Check logs with 'docker compose -f backend/docker-compose.yml logs -f backend'."
    }
}

$runMode = Resolve-RunMode

if ($runMode -eq "local-clean") {
    Write-Host "Running in local-clean mode (fresh local backend)." -ForegroundColor Yellow
    & "$root\backend\scripts\reset-deployment-db.ps1"
    Wait-ForLocalBackendHealth
}
elseif ($runMode -eq "local-existing") {
    Write-Host "Running in local-existing mode (no reset)." -ForegroundColor Yellow
    Push-Location "$root\backend"
    try {
        $dockerArgs = "up", "-d"
        if ($Rebuild) {
            $dockerArgs += "--build"
        }
        docker compose $dockerArgs
    }
    finally {
        Pop-Location
    }
    Wait-ForLocalBackendHealth
}
else {
    Write-Host "Running in live mode (safe: no local DB reset)." -ForegroundColor Green
    Write-Host "Using deployed backend API: $ApiUrl" -ForegroundColor Green
}

if (-not $NoStart) {
    $frontendApiUrl = if ($runMode -eq "live") { $ApiUrl } else { "http://localhost" }
    $frontendCommand = "`$env:EXPO_PUBLIC_API_URL='$frontendApiUrl'; `$env:EXPO_PUBLIC_API_FALLBACK_URL='$frontendApiUrl'; npm run frontend"
    Start-Process powershell -WorkingDirectory "$root\frontend" -ArgumentList "-NoExit", "-Command", $frontendCommand

    if ($androidSdkPath) {
        Try-StartAndroidEmulator $androidSdkPath
    }
}

$liveBackendState = "unavailable"
try {
    $composeFile = Join-Path $root "backend\docker-compose.yml"
    $statusOutput = docker compose -f $composeFile ps backend 2>$null
    if ($LASTEXITCODE -eq 0) {
        $liveBackendState = if (($statusOutput | Out-String) -match "Up") { "running" } else { "not running" }
    }
}
catch {}

Write-Host ""
Write-Host "===== Summary =====" -ForegroundColor Cyan
Write-Host "Action: Run-all workflow executed in mode '$runMode'"
Write-Host "Updated: Frontend startup and selected backend workflow applied"
Write-Host "Live backend: $liveBackendState"

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
