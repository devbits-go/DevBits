param(
    [string]$ApiUrl = "https://devbits.ddns.net"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting frontend against API: $ApiUrl" -ForegroundColor Green

# Launch frontend in a new PowerShell window so logs stay visible
Start-Process powershell -WorkingDirectory "$root\frontend" -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; `$env:EXPO_PUBLIC_API_URL='$ApiUrl'; `$env:EXPO_PUBLIC_API_FALLBACK_URL='$ApiUrl'; npm run frontend"

Write-Host "===== Summary =====" -ForegroundColor Cyan
Write-Host "Action: Started frontend"
Write-Host "Frontend API URL: $ApiUrl"

