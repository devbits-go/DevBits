param(
    [switch]$KeepUploads,
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

Write-Host "Resetting DevBits deployment database to a blank slate..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")
Push-Location $root
try {
    $envFile = Join-Path $root ".env"
    if (-not (Test-Path $envFile)) {
        throw "Missing $envFile. Create it from backend/.env.example and set strong credentials before resetting."
    }

    $envRaw = Get-Content -Path $envFile -Raw
    $dbUrl = $null
    if ($envRaw -match "(?m)^DATABASE_URL=(.+)$") {
        $dbUrl = $Matches[1].Trim()
    }
    if ([string]::IsNullOrWhiteSpace($dbUrl)) {
        throw "Missing DATABASE_URL in $envFile"
    }

    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
        throw "psql not found in PATH. Install PostgreSQL client tools first."
    }

    psql $dbUrl -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE;"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed dropping public schema."
    }

    psql $dbUrl -v ON_ERROR_STOP=1 -c "CREATE SCHEMA public;"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed creating public schema."
    }

    if (-not $KeepUploads) {
        $uploadsPath = Join-Path $root "uploads"
        if (Test-Path $uploadsPath) {
            Get-ChildItem -Path $uploadsPath -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $hasService = (Get-Command systemctl -ErrorAction SilentlyContinue)
    if ($hasService) {
        systemctl list-unit-files | Select-String -Pattern '^devbits-api\.service' | Out-Null
        if ($LASTEXITCODE -eq 0) {
            sudo systemctl restart devbits-api
        }
    }

    Write-Host "Database reset complete. All users and app data are removed." -ForegroundColor Green
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "===== Summary =====" -ForegroundColor Cyan
Write-Host "Action: Deployment DB reset executed"
Write-Host "Updated: Public schema recreated (blank state)"
Write-Host "Database reset target: DATABASE_URL"

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
