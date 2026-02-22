param(
    [string]$BackupDir = "backups\db",
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = "& '" + $myinvocation.mycommand.definition + "'"
    Start-Process powershell -Verb runAs -ArgumentList $arguments
    exit
}

Write-Host "Creating deployment database backup..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir "..")
Push-Location $root
try {
    $backupPath = Join-Path $root $BackupDir
    New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

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

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $dbBackupFileName = "devbits-db-$timestamp.sql"
    $dbBackupFile = Join-Path $backupPath $dbBackupFileName
    
    docker compose exec -T db pg_dump -U $dbUser -d $dbName --no-owner --no-privileges | Out-File -FilePath $dbBackupFile -Encoding utf8
    
    if (-not (Test-Path $dbBackupFile)) {
        throw "Database backup file was not created."
    }
    
    $uploadsDir = Join-Path $root "uploads"
    $uploadsBackupFileName = "devbits-uploads-$timestamp.zip"
    $uploadsBackupFile = Join-Path $backupPath $uploadsBackupFileName
    
    if (Test-Path $uploadsDir) {
        Compress-Archive -Path "$uploadsDir\*" -DestinationPath $uploadsBackupFile -Force
        Write-Host "Uploads backup created: $uploadsBackupFile" -ForegroundColor Green
    }
    else {
        Write-Host "Uploads directory not found, skipping backup." -ForegroundColor Yellow
    }

    $filesToKeep = @(
        (Get-ChildItem -Path $backupPath -Filter "devbits-db-*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
        (Get-ChildItem -Path $backupPath -Filter "devbits-uploads-*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
    )

    Get-ChildItem -Path $backupPath -File | Where-Object { $_.FullName -notin $filesToKeep } | Remove-Item -Force

    Write-Host "Backup created: $dbBackupFile" -ForegroundColor Green
    Write-Host "Retention applied: only latest backup of each type is kept." -ForegroundColor Green
}
finally {
    Pop-Location
}

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
Write-Host "Action: Deployment backup created"
Write-Host "Updated: Latest DB + uploads backup files retained"
Write-Host "Live backend: $liveBackendState"

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
