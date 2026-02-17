param(
    [switch]$KeepBackend
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-PortListening([int]$Port) {
    try {
        $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1
        return $null -ne $listener
    }
    catch {
        $netstatMatch = netstat -ano | Select-String -Pattern (":$Port\s+.*LISTENING") -SimpleMatch:$false
        return $null -ne $netstatMatch
    }
}

function Get-ListeningProcessName([int]$Port) {
    try {
        $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1
        if ($null -eq $listener) {
            return $null
        }
        $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            return "$($process.ProcessName) (PID $($process.Id))"
        }
        return "PID $($listener.OwningProcess)"
    }
    catch {
        return $null
    }
}

function Get-ListeningProcess([int]$Port) {
    try {
        $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1
        if ($null -eq $listener) {
            return $null
        }
        $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            return [PSCustomObject]@{
                Id   = $process.Id
                Name = $process.ProcessName
            }
        }
        return [PSCustomObject]@{
            Id   = $listener.OwningProcess
            Name = "unknown"
        }
    }
    catch {
        return $null
    }
}

function Test-BackendHealthy {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200 -and $response.Content -match "API is running"
    }
    catch {
        return $false
    }
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

$backendCommand = "`$env:DEVBITS_DEBUG=1; go run ./api"

$frontendEnv = ""
if ($androidSdkPath) {
    $frontendEnv = "`$env:ANDROID_HOME='$androidSdkPath'; `$env:ANDROID_SDK_ROOT='$androidSdkPath'; "
    $platformTools = Join-Path $androidSdkPath "platform-tools"
    if (Test-Path $platformTools) {
        $frontendEnv += "`$env:Path='$platformTools;' + `$env:Path; "
    }
    $emulatorPath = Join-Path $androidSdkPath "emulator"
    if (Test-Path $emulatorPath) {
        $frontendEnv += "`$env:Path='$emulatorPath;' + `$env:Path; "
    }
}

$frontendCommand = "${frontendEnv}npm run frontend"

$backendHealthy = Test-BackendHealthy
$portInUse = Test-PortListening 8080

$startBackend = $true

if ($portInUse) {
    $ownerInfo = Get-ListeningProcess 8080
    $ownerLabel = if ($ownerInfo) { "$($ownerInfo.Name) (PID $($ownerInfo.Id))" } else { "unknown process" }

    if ($KeepBackend -and $backendHealthy) {
        Write-Host "Backend is healthy on http://localhost:8080; keeping existing process ($ownerLabel)." -ForegroundColor Yellow
        $startBackend = $false
    }
    elseif ($ownerInfo -and ($ownerInfo.Name -match "^(api|go)$")) {
        if ($backendHealthy) {
            Write-Host "Restarting existing backend process on port 8080 ($ownerLabel)..." -ForegroundColor Yellow
        }
        else {
            Write-Warning "Port 8080 is occupied by stale $ownerLabel and /health failed. Restarting backend process."
        }

        try {
            Stop-Process -Id $ownerInfo.Id -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 700
        }
        catch {
            Write-Warning "Could not stop $ownerLabel."
        }

        if (Test-PortListening 8080) {
            Write-Warning "Port 8080 is still busy after stop attempt. Backend start aborted."
            $startBackend = $false
        }
    }
    elseif ($backendHealthy) {
        Write-Host "Backend healthy on port 8080 via $ownerLabel; leaving existing service running." -ForegroundColor Yellow
        $startBackend = $false
    }
    else {
        Write-Warning "Port 8080 is in use by $ownerLabel, and /health failed. Backend was not started to avoid killing unrelated processes."
        $startBackend = $false
    }
}

if ($startBackend) {
    Write-Host "Starting backend..." -ForegroundColor Yellow
    $backendProcess = Start-Process powershell -WorkingDirectory "$root\backend" -ArgumentList "-NoExit", "-Command", $backendCommand -PassThru
    Start-Sleep -Seconds 2
    if (Test-BackendHealthy) {
        Write-Host "Backend started successfully (PID $($backendProcess.Id))." -ForegroundColor Green
    }
    else {
        Write-Warning "Backend process launched (PID $($backendProcess.Id)) but /health is not responding yet. Check the backend terminal window for errors."
    }
}
Start-Process powershell -WorkingDirectory "$root\frontend" -ArgumentList "-NoExit", "-Command", $frontendCommand

if ($androidSdkPath) {
    Try-StartAndroidEmulator $androidSdkPath
}
