param(
    [string]$BackupDir = "backups\db",
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

Write-Host "Restoring deployment database from backup..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")
$failed = $false

try {
    Push-Location $root
    try {
        $backupPath = Join-Path $root $BackupDir
        if (-not (Test-Path $backupPath)) {
            throw "Backup directory not found: $backupPath"
        }

        $latest = Get-ChildItem -Path $backupPath -File -Filter "devbits-db-*.sql" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

        if (-not $latest) {
            throw "No backup files found in $backupPath"
        }

        $resolvedBackup = $latest.FullName

        Write-Host "Using backup: $resolvedBackup" -ForegroundColor Cyan

        $envFile = Join-Path $root ".env"
        if (-not (Test-Path $envFile)) {
            throw "Missing $envFile. Create it from backend/.env.example and set DATABASE_URL."
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

        Get-Content -Path $resolvedBackup -Raw | psql $dbUrl -v ON_ERROR_STOP=1
        if ($LASTEXITCODE -ne 0) {
            throw "Restore failed while applying SQL backup."
        }

        $dbTimestamp = [System.IO.Path]::GetFileNameWithoutExtension($latest.Name) -replace '^devbits-db-', ''
        $uploadsZip = Join-Path $backupPath ("devbits-uploads-" + $dbTimestamp + ".zip")
        $uploadsTar = Join-Path $backupPath ("devbits-uploads-" + $dbTimestamp + ".tar.gz")

        $uploadsDir = Join-Path $root "uploads"
        New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null

        if (Test-Path $uploadsZip) {
            Get-ChildItem -Path $uploadsDir -File -ErrorAction SilentlyContinue | Remove-Item -Force
            Expand-Archive -Path $uploadsZip -DestinationPath $uploadsDir -Force
            Write-Host "Uploads restored from: $uploadsZip" -ForegroundColor Green
        }
        elseif (Test-Path $uploadsTar) {
            Get-ChildItem -Path $uploadsDir -File -ErrorAction SilentlyContinue | Remove-Item -Force
            tar -xzf $uploadsTar -C $uploadsDir
            if ($LASTEXITCODE -ne 0) {
                throw "Restore failed while extracting uploads archive."
            }
            Write-Host "Uploads restored from: $uploadsTar" -ForegroundColor Green
        }
        else {
            Write-Host "No matching uploads backup found for timestamp $dbTimestamp, keeping current uploads directory." -ForegroundColor Yellow
        }

        $hasService = (Get-Command systemctl -ErrorAction SilentlyContinue)
        if ($hasService) {
            systemctl list-unit-files | Select-String -Pattern '^devbits-api\.service' | Out-Null
            if ($LASTEXITCODE -eq 0) {
                sudo systemctl restart devbits-api
            }
        }

        Write-Host "Restore complete." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
catch {
    $failed = $true
    Write-Error $_
}
finally {
    $operationState = if ($failed) { "failed" } else { "success" }
    Write-Host ""
    Write-Host "===== Summary =====" -ForegroundColor Cyan
    Write-Host "Action: Deployment DB restore executed ($operationState)"
    Write-Host "Updated: Database restored and matching uploads restored when available"
    Write-Host "Database restore target: DATABASE_URL"

    if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
        Read-Host "Press Enter to close"
    }
}

if ($failed) {
    exit 1
}
