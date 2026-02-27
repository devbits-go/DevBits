# Script: run-front.ps1
# Does: Starts Expo frontend and lets you choose backend target (Production or Local).
# Use: .\run-front.ps1 [-Local|-Production] [-Clear]
# DB: None (frontend only).
# Ports: Metro uses LAN IP; local API defaults to :8080 (EXPO_PUBLIC_LOCAL_API_PORT overrides).
# Modes: Frontend=ON | Backend=Production URL or Local URL | Live stack untouched | Dev/Test DB untouched.

param(
    [switch]$Clear,
    [switch]$Local,
    [switch]$Production
)

$ErrorActionPreference = "Stop"

if ($Local -and $Production) {
    Write-Host "Choose either -Local or -Production, not both." -ForegroundColor Red
    exit 1
}

function Get-LanIPv4 {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.PrefixOrigin -eq 'Dhcp' -and
        $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress

    if (-not $ip) {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'
        } |
        Select-Object -First 1 -ExpandProperty IPAddress
    }

    if (-not $ip) {
        Write-Host "Warning: Could not detect private LAN IPv4. Falling back to 127.0.0.1." -ForegroundColor Yellow
        return "127.0.0.1"
    }

    return $ip
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $root "frontend"
$localIp = Get-LanIPv4

$mode = ""
if ($Local) {
    $mode = "local"
}
elseif ($Production) {
    $mode = "production"
}
else {
    Write-Host "Select backend: 1) Production (devbits.ddns.net) 2) Local (LAN IP:8080)"
    $selection = Read-Host "Choose [1/2]"
    switch ($selection) {
        "1" { $mode = "production" }
        "2" { $mode = "local" }
        default {
            Write-Host "Invalid selection." -ForegroundColor Red
            exit 1
        }
    }
}

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $localIp
$env:EXPO_PACKAGER_HOSTNAME = $localIp
$env:EXPO_PUBLIC_API_URL = "https://devbits.ddns.net"
$env:EXPO_PUBLIC_API_FALLBACK_URL = "https://devbits.ddns.net"

if ($mode -eq "local") {
    $port = if ($env:EXPO_PUBLIC_LOCAL_API_PORT) { $env:EXPO_PUBLIC_LOCAL_API_PORT } else { "8080" }
    $env:EXPO_PUBLIC_USE_LOCAL_API = "1"
    $env:EXPO_PUBLIC_LOCAL_API_URL = "http://$($localIp):$port"
    Write-Host "Using local backend: $($env:EXPO_PUBLIC_LOCAL_API_URL)" -ForegroundColor Green
}
else {
    $env:EXPO_PUBLIC_USE_LOCAL_API = "0"
    Remove-Item Env:EXPO_PUBLIC_LOCAL_API_URL -ErrorAction SilentlyContinue
    Write-Host "Using production backend: https://devbits.ddns.net" -ForegroundColor Green
}

Push-Location $frontendDir
try {
    if ($Clear) {
        & npx expo start --dev-client --clear
    }
    else {
        & npx expo start --dev-client
    }
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
