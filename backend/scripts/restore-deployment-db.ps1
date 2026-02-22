param(
    [string]$BackupDir = "backups\db",
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $argumentList = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-NoExit",
        "-File", "`"$($MyInvocation.MyCommand.Path)`""
    )

    if ($PSBoundParameters.ContainsKey("BackupDir")) {
        $argumentList += @("-BackupDir", "`"$BackupDir`"")
    }
    if ($NoPause) {
        $argumentList += "-NoPause"
    }

    Start-Process powershell -Verb runAs -ArgumentList ($argumentList -join " ")
    exit
}

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
        $dbUser = "devbits"
        $dbName = "devbits"
        if (Test-Path $envFile) {
            $envRaw = Get-Content -Path $envFile -Raw
            if ($envRaw -match "(?m)^POSTGRES_USER=(.+)$") {
                $dbUser = $Matches[1].Trim()
            }
            if ($envRaw -match "(?m)^POSTGRES_DB=(.+)$") {
                $dbName = $Matches[1].Trim()
            }
        }

        $terminateSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$dbName' AND pid <> pg_backend_pid();"
        $dropDbSql = "DROP DATABASE IF EXISTS `"$dbName`;"
        $createDbSql = "CREATE DATABASE `"$dbName`;"

        docker compose exec -T db psql -U $dbUser -d postgres -c $terminateSql
        if ($LASTEXITCODE -ne 0) {
            throw "Failed terminating active connections."
        }

        docker compose exec -T db psql -U $dbUser -d postgres -c $dropDbSql
        if ($LASTEXITCODE -ne 0) {
            throw "Failed dropping existing database."
        }

        docker compose exec -T db psql -U $dbUser -d postgres -c $createDbSql
        if ($LASTEXITCODE -ne 0) {
            throw "Failed creating target database."
        }

        Get-Content -Path $resolvedBackup -Raw | docker compose exec -T db psql -U $dbUser -d $dbName
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

        Write-Host "Restore complete. Rebuilding deployment services..." -ForegroundColor Yellow

        docker compose up -d --build
        if ($LASTEXITCODE -ne 0) {
            throw "Restore completed, but service rebuild failed."
        }

        Write-Host "Restore complete and services rebuilt." -ForegroundColor Green
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
    $liveBackendState = "unavailable"
    try {
        $statusOutput = docker compose -f (Join-Path $root "docker-compose.yml") ps backend 2>$null
        if ($LASTEXITCODE -eq 0) {
            $liveBackendState = if (($statusOutput | Out-String) -match "Up") { "running" } else { "not running" }
        }
    }
    catch {}

    Write-Host ""
    Write-Host "===== Summary =====" -ForegroundColor Cyan
    Write-Host "Action: Deployment DB restore executed ($operationState)"
    Write-Host "Updated: Database restored and matching uploads restored when available; services rebuilt"
    Write-Host "Live backend: $liveBackendState"

    if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
        Read-Host "Press Enter to close"
    }
}

if ($failed) {
    exit 1
}
