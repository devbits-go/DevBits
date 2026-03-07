param(
    [Parameter(Mandatory = $true)]
    [string]$ServerHost,
    [string]$User = "ubuntu",
    [string]$ProjectPath = "/opt/devbits/backend",
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

Write-Host "Deploying backend on AWS host $User@$ServerHost using native Linux deploy script..." -ForegroundColor Yellow

$remoteCommand = "cd $ProjectPath && ./scripts/deploy-aws-native.sh"
ssh "$User@$ServerHost" $remoteCommand

if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy failed with exit code $LASTEXITCODE"
}

Write-Host "Remote deploy completed successfully." -ForegroundColor Green

if (-not $NoPause -and [Environment]::UserInteractive -and $Host.Name -eq "ConsoleHost") {
    Read-Host "Press Enter to close"
}
