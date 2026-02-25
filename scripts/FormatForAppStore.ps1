# =============================================
# FormatForAppStore.ps1
# Set max frame rate to 30 FPS for videos
# =============================================

# --- Edit this array with your video filenames ---
$videos = @(
    preview.mp4,
    preview1.mp4,
    preview2.mp4
)

# --- Script body ---
foreach ($file in $videos) {
    if (-Not (Test-Path $file)) {
        Write-Host File not found $file -ForegroundColor Red
        continue
    }

    $baseName = [System.IO.Path]GetFileNameWithoutExtension($file)
    $output = ${baseName}_30fps.mp4

    Write-Host Processing $file → $output ... -ForegroundColor Cyan

    ffmpeg -i $file -r 30 -cv libx264 -crf 23 -preset fast -ca aac $output

    if ($LASTEXITCODE -eq 0) {
        Write-Host Finished $output -ForegroundColor Green
    } else {
        Write-Host Error processing $file -ForegroundColor Red
    }
}

Write-Host All done! -ForegroundColor Yellow