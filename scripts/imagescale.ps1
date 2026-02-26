# =============================================
# Resize images to 2064x2752 for App Store
# Preserves aspect ratio + pads if needed
# =============================================

# --- Edit filenames here ---
$images = @(
    "input.PNG"
)

$width = 2064
$height = 2752

foreach ($file in $images) {

    if (-Not (Test-Path $file)) {
        Write-Host "File not found: $file" -ForegroundColor Red
        continue
    }

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file)
    $extension = [System.IO.Path]::GetExtension($file)
    $output = "${baseName}_AppStore${extension}"

    Write-Host "Processing $file → $output ..." -ForegroundColor Cyan

    ffmpeg -i $file `
        -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2" `
        $output

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Finished: $output" -ForegroundColor Green
    } else {
        Write-Host "Error processing $file" -ForegroundColor Red
    }
}

Write-Host "All done!" -ForegroundColor Yellow