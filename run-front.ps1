param(
    [string]$ApiUrl = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress

    if ([string]::IsNullOrWhiteSpace($lanIp)) {
        $lanIp = "localhost"
    }

    $ApiUrl = "http://$lanIp"
}

Write-Host "Starting frontend against API: $ApiUrl" -ForegroundColor Green

# Launch frontend in a new PowerShell window so logs stay visible
Start-Process powershell -WorkingDirectory "$root\frontend" -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; `$env:EXPO_PUBLIC_USE_LOCAL_API='1'; `$env:EXPO_PUBLIC_API_URL='$ApiUrl'; `$env:EXPO_PUBLIC_API_FALLBACK_URL='$ApiUrl'; npm run frontend"

Write-Host "===== Summary =====" -ForegroundColor Cyan
Write-Host "Action: Started frontend"
Write-Host "Frontend API URL: $ApiUrl"

