# =============================================
# App Store App Preview Formatter
# - Trims to 30 seconds max
# - Errors if under 15 seconds
# - 886x1920 | 30fps | 10-12 Mbps
# =============================================

# -------- EDIT THIS --------
$inputFile = "input.mp4"
# ---------------------------

$width = 886
$height = 1920

if (-Not (Test-Path $inputFile)) {
    Write-Host "Input file not found: $inputFile" -ForegroundColor Red
    exit
}

# Get duration using ffprobe
$duration = ffprobe -v error -show_entries format=duration `
    -of default=noprint_wrappers=1:nokey=1 "$inputFile"

$duration = [math]::Round([double]$duration,2)

Write-Host "Video duration: $duration seconds"

# Fail if under 15 seconds
if ($duration -lt 15) {
    Write-Host "ERROR: Video must be at least 15 seconds long." -ForegroundColor Red
    exit
}

# Trim if over 30 seconds
$trimDuration = 30
if ($duration -le 30) {
    $trimDuration = $duration
}

$baseName = [System.IO.Path]::GetFileNameWithoutExtension($inputFile)
$outputFile = "${baseName}_AppPreview.mp4"

Write-Host "Formatting for App Store..." -ForegroundColor Cyan

ffmpeg -y -i "$inputFile" `
    -t $trimDuration `
    -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=30" `
    -c:v libx264 `
    -profile:v high `
    -level 4.0 `
    -pix_fmt yuv420p `
    -b:v 11M `
    -maxrate 12M `
    -bufsize 24M `
    -movflags +faststart `
    -c:a aac `
    -b:a 256k `
    -ac 2 `
    -ar 44100 `
    "$outputFile"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success! Output created:" -ForegroundColor Green
    Write-Host "$outputFile"
} else {
    Write-Host "Error during processing." -ForegroundColor Red
}