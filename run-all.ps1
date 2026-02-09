$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Start-Process powershell -WorkingDirectory "$root\backend" -ArgumentList "-NoExit", "-Command", "`$env:DEVBITS_DEBUG=1; go run ./api"
Start-Process powershell -WorkingDirectory "$root\frontend" -ArgumentList "-NoExit", "-Command", "npm run frontend"
