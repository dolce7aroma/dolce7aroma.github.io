Add-Type -AssemblyName System.Drawing
$brain = Join-Path $env:USERPROFILE ".gemini\antigravity\brain\7b894607-11dd-48a6-8997-4fe78cfe89be"
$srcFile = Join-Path $brain "logo_clean_black.png"
$src = [System.Drawing.Bitmap]::FromFile($srcFile)

# Top logo exact crop
$cropX = 85
$cropY = 40
$cropW = 312
$cropH = 150

$out = [System.Drawing.Bitmap]::new($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $cropH; $y++) {
    for ($x = 0; $x -lt $cropW; $x++) {
        $p = $src.GetPixel(($cropX + $x), ($cropY + $y))
        $lum = [int](0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B)
        if ($lum -ge 245) {
            $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($lum -le 30) {
            $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 10, 10, 10))
        } else {
            $alpha = [int](255 * (245 - $lum) / (245 - 30))
            if ($alpha -gt 255) { $alpha = 255 }
            if ($alpha -lt 0) { $alpha = 0 }
            $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 10, 10, 10))
        }
    }
}

$destPath = "assets\logo-clean-black.png"
$out.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Save((Join-Path $brain "logo_transparent_black.png"), [System.Drawing.Imaging.ImageFormat]::Png)

Write-Host "Created transparent black logo successfully: $cropW x $cropH"

$src.Dispose()
$out.Dispose()
