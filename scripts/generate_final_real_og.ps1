Add-Type -AssemblyName System.Drawing

$brain = Join-Path $env:USERPROFILE ".gemini\antigravity\brain\7b894607-11dd-48a6-8997-4fe78cfe89be"

# 1. Clean extraction of the 3 bottles from real photography
function Get-CleanBottleBitmap {
    param(
        [string]$imgFile,
        [int]$startX, [int]$startY, [int]$w, [int]$h
    )
    $src = [System.Drawing.Bitmap]::FromFile($imgFile)
    $dest = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $c = $src.GetPixel($startX + $x, $startY + $y)
            $avg = ($c.R + $c.G + $c.B) / 3.0
            $diffMax = [Math]::Max([Math]::Abs($c.R - $c.G), [Math]::Max([Math]::Abs($c.G - $c.B), [Math]::Abs($c.R - $c.B)))
            
            $isBgGrey = ($diffMax -le 16) -and ($avg -ge 92) -and ($avg -le 145)
            $isCap = ($c.G -gt $c.R + 25) -or ($c.B -gt $c.R + 25)
            $isLabel = ($avg -gt 205) -or (($c.R -lt 55) -and ($c.G -lt 55) -and ($c.B -lt 55) -and ($y -gt ($h * 0.4)))
            $isBottomTrim = ($y -gt ($h - 4)) -and ($avg -gt 150)
            
            if (($isBgGrey -and -not $isCap -and -not $isLabel) -or $isBottomTrim) {
                $dest.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                $dest.SetPixel($x, $y, $c)
            }
        }
    }
    $src.Dispose()
    return $dest
}

# 110ml bottle
$b110 = Get-CleanBottleBitmap "assets\perfume-110ml.jpg" 212 612 188 432
# 50ml bottle
$b50 = Get-CleanBottleBitmap "assets\perfume-50ml.jpg" 172 636 178 410
# 10ml bottle
$b10 = Get-CleanBottleBitmap "assets\perfume-10ml.jpg" 245 632 70 410

# 2. Master Canvas Setup (1200 x 630 px)
$width = 1200
$height = 630
$bmp = [System.Drawing.Bitmap]::new($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Background: Rich dark luxury gradient
$bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    ([System.Drawing.Point]::new(0, 0)),
    ([System.Drawing.Point]::new($width, $height)),
    [System.Drawing.Color]::FromArgb(255, 6, 8, 12),
    [System.Drawing.Color]::FromArgb(255, 14, 18, 26)
)
$g.FillRectangle($bgBrush, 0, 0, $width, $height)
$bgBrush.Dispose()

# Ambient warm gold glow behind real bottles on the right
$glowPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
$glowPath.AddEllipse(640, 50, 520, 520)
$glowBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new($glowPath)
$glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(55, 212, 175, 55)
$glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 6, 8, 12))
$g.FillPath($glowBrush, $glowPath)
$glowBrush.Dispose()
$glowPath.Dispose()

# Floor reflection line & dark marble podium surface
$floorY = 485
$floorBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    ([System.Drawing.Point]::new(0, $floorY)),
    ([System.Drawing.Point]::new(0, $height)),
    [System.Drawing.Color]::FromArgb(190, 18, 22, 32),
    [System.Drawing.Color]::FromArgb(255, 6, 8, 12)
)
$g.FillRectangle($floorBrush, 580, $floorY, ($width - 580), ($height - $floorY))
$floorBrush.Dispose()

# Subtle gold reflection floor line
$floorPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(90, 212, 175, 55), 1.0)
$g.DrawLine($floorPen, 600, $floorY, 1160, $floorY)
$floorPen.Dispose()

# 3. Draw Real Bottles with Realistic Mirror Reflection
function Draw-BottleWithReflection {
    param(
        [System.Drawing.Graphics]$graphics,
        [System.Drawing.Bitmap]$bottleBmp,
        [int]$posX, [int]$posY, [int]$targetW, [int]$targetH
    )
    $reflH = [int]($targetH * 0.40)
    $reflBmp = [System.Drawing.Bitmap]::new($targetW, $reflH)
    $rg = [System.Drawing.Graphics]::FromImage($reflBmp)
    $rg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $rg.DrawImage($bottleBmp, [System.Drawing.Rectangle]::new(0, 0, $targetW, $reflH), [System.Drawing.Rectangle]::new(0, ($bottleBmp.Height - [int]($bottleBmp.Height * 0.40)), $bottleBmp.Width, [int]($bottleBmp.Height * 0.40)), [System.Drawing.GraphicsUnit]::Pixel)
    $reflBmp.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipY)
    
    $fadeBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        ([System.Drawing.Point]::new(0, 0)),
        ([System.Drawing.Point]::new(0, $reflH)),
        [System.Drawing.Color]::FromArgb(120, 0, 0, 0),
        [System.Drawing.Color]::FromArgb(255, 6, 8, 12)
    )
    $rg.FillRectangle($fadeBrush, 0, 0, $targetW, $reflH)
    $fadeBrush.Dispose()
    $rg.Dispose()
    
    $graphics.DrawImage($reflBmp, $posX, ($posY + $targetH - 3), $targetW, $reflH)
    $reflBmp.Dispose()
    
    $graphics.DrawImage($bottleBmp, $posX, $posY, $targetW, $targetH)
}

# Draw 110ml (Right)
Draw-BottleWithReflection $g $b110 930 75 195 442
# Draw 50ml (Center)
Draw-BottleWithReflection $g $b50 760 115 165 380
# Draw 10ml (Left)
Draw-BottleWithReflection $g $b10 675 165 55 325

$b110.Dispose()
$b50.Dispose()
$b10.Dispose()

# Bottle labels badges below reflection
$fontCap = [System.Drawing.Font]::new("Arial", [single]10, [System.Drawing.FontStyle]::Bold)
$goldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 230, 195, 100))
$sfCenter = [System.Drawing.StringFormat]::new()
$sfCenter.Alignment = [System.Drawing.StringAlignment]::Center

$g.DrawString("10ml", $fontCap, $goldBrush, 702, 500, $sfCenter)
$g.DrawString("50ml", $fontCap, $goldBrush, 842, 500, $sfCenter)
$g.DrawString("110ml", $fontCap, $goldBrush, 1027, 500, $sfCenter)

# 4. Outer Luxury Double Border
$goldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180, 212, 175, 55), 1.5)
$g.DrawRectangle($goldPen, 16, 16, $width - 32, $height - 32)
$thinGoldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, 212, 175, 55), 1.0)
$g.DrawRectangle($thinGoldPen, 22, 22, $width - 44, $height - 44)
$goldPen.Dispose()
$thinGoldPen.Dispose()

# 5. Left Content: Brand & Value Prop
$brightGoldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 225, 130))
$whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$lightGrayBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 205, 210, 220))
$emeraldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 52, 211, 153))

$fontTag = [System.Drawing.Font]::new("Arial", [single]10.5, [System.Drawing.FontStyle]::Bold)
$fontH1 = [System.Drawing.Font]::new("Georgia", [single]25, [System.Drawing.FontStyle]::Bold)
$fontSub = [System.Drawing.Font]::new("Arial", [single]12.5, [System.Drawing.FontStyle]::Regular)
$fontPriceTitle = [System.Drawing.Font]::new("Arial", [single]10, [System.Drawing.FontStyle]::Bold)
$fontPriceNum = [System.Drawing.Font]::new("Georgia", [single]20, [System.Drawing.FontStyle]::Bold)
$fontPriceLabel = [System.Drawing.Font]::new("Arial", [single]9, [System.Drawing.FontStyle]::Regular)

# A. OFFICIAL GOLD LOGO DIGITALIZED (Top-Left X: 52, Y: 36)
$logoGoldPath = "assets\logo-gold-cropped.png"
if (Test-Path $logoGoldPath) {
    $logoGold = [System.Drawing.Image]::FromFile((Resolve-Path $logoGoldPath))
    $logoW = 215
    $logoH = [int]($logoW * ($logoGold.Height / $logoGold.Width))
    $g.DrawImage($logoGold, 52, 36, $logoW, $logoH)
    $logoGold.Dispose()
}

# Tagline above headline
$g.DrawString("PERFUMERIA DE AUTOR * INSPIRACIONES DE DISENADOR", $fontTag, $goldBrush, 52, 142)

# Main Headline
$g.DrawString("Fragancias con Fijacion Real", $fontH1, $whiteBrush, 50, 168)
$g.DrawString("de 8 a 12 Horas", $fontH1, $brightGoldBrush, 50, 204)

# Subtitle
$g.DrawString("Maceracion francesa con esencias puras importadas.", $fontSub, $lightGrayBrush, 52, 252)
$g.DrawString("Presentaciones reales de 10ml, 50ml y 110ml para Lima.", $fontSub, $lightGrayBrush, 52, 274)

# B. 3 Price Cards (Properly Spaced & Clean)
$cardY = 308
$cardH = 92
$cardW = 160
$spacing = 14

$prices = @(
    @{ Name = "POCKET"; Size = "10ml"; Price = "S/ 15"; Sub = "Para llevar" },
    @{ Name = "CLASICO"; Size = "50ml"; Price = "S/ 65"; Sub = "Mas vendido" },
    @{ Name = "SIGNATURE"; Size = "110ml"; Price = "S/ 115"; Sub = "Maxima duracion" }
)

for ($i = 0; $i -lt $prices.Count; $i++) {
    $cX = 52 + ($i * ($cardW + $spacing))
    
    $cardBg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235, 14, 18, 28))
    $g.FillRectangle($cardBg, $cX, $cardY, $cardW, $cardH)
    $cardBg.Dispose()
    
    $cBorderColor = if ($i -eq 1) { [System.Drawing.Color]::FromArgb(210, 212, 175, 55) } else { [System.Drawing.Color]::FromArgb(90, 212, 175, 55) }
    $cPen = [System.Drawing.Pen]::new($cBorderColor, 1.2)
    $g.DrawRectangle($cPen, $cX, $cardY, $cardW, $cardH)
    $cPen.Dispose()
    
    $g.DrawString("$($prices[$i].Name) ($($prices[$i].Size))", $fontPriceTitle, $goldBrush, ($cX + ($cardW/2)), ($cardY + 16), $sfCenter)
    $pBrush = if ($i -eq 1) { $brightGoldBrush } else { $whiteBrush }
    $g.DrawString($prices[$i].Price, $fontPriceNum, $pBrush, ($cX + ($cardW/2)), ($cardY + 44), $sfCenter)
    $g.DrawString($prices[$i].Sub, $fontPriceLabel, $lightGrayBrush, ($cX + ($cardW/2)), ($cardY + 72), $sfCenter)
}

# C. Bottom Trust Badges (Y: 418 - 564)
$badgeBg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 11, 14, 22))
$g.FillRectangle($badgeBg, 52, 416, 508, 148)
$badgeBg.Dispose()

$badgePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(80, 212, 175, 55), 1.0)
$g.DrawRectangle($badgePen, 52, 416, 508, 148)
$badgePen.Dispose()

$fontBTitle = [System.Drawing.Font]::new("Arial", [single]10.5, [System.Drawing.FontStyle]::Bold)
$fontBSub = [System.Drawing.Font]::new("Arial", [single]9.5, [System.Drawing.FontStyle]::Regular)

$g.DrawString("+ DELIVERY GRATIS en Lima Metropolitana", $fontBTitle, $whiteBrush, 68, 432)
$g.DrawString("Por compras desde S/ 100 con entrega rapida y segura a domicilio", $fontBSub, $lightGrayBrush, 68, 452)

$divPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(40, 255, 255, 255), 1.0)
$g.DrawLine($divPen, 68, 478, 542, 478)
$divPen.Dispose()

$g.DrawString("+ PAGOS SEGUROS: Tarjetas (Mercado Pago), Yape y Plin", $fontBTitle, $emeraldBrush, 68, 492)
$g.DrawString("Punto de Recojo en SMP: Jr. Callao 482-A (Bazar Shirley)", $fontBSub, $lightGrayBrush, 68, 514)

# Quality encoder params for crisp JPEG
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoderParams = [System.Drawing.Imaging.EncoderParameters]::new(1)
$encoderParams.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]95)

# Save Outputs
$outJpg = "assets\og-cover-dolce7aroma.jpg"
$bmp.Save($outJpg, $codec, $encoderParams)
$bmp.Save("assets\frascos-dolcearoma.jpg", $codec, $encoderParams)
$bmp.Save((Join-Path $brain "og-cover-dolce7aroma.jpg"), $codec, $encoderParams)

Write-Host "Real bottles and authentic logo digitalized successfully!"

$bmp.Dispose()
$g.Dispose()
