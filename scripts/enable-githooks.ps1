Write-Host "Setting Git hooksPath to .githooks for repository at $(Get-Location)"
git config core.hooksPath .githooks
Write-Host "Run 'git config --local --get core.hooksPath' to verify."
