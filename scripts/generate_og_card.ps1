Add-Type -AssemblyName System.Drawing

$width = 1200
$height = 630

$bmp = [System.Drawing.Bitmap]::new($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# 1. Base dark background (matches flyer's deep black/dark tones)
$baseColor = [System.Drawing.Color]::FromArgb(255, 6, 7, 10)
$bgBrush = [System.Drawing.SolidBrush]::new($baseColor)
$g.FillRectangle($bgBrush, 0, 0, $width, $height)
$bgBrush.Dispose()

# 2. Draw Luxury Real Perfume Bottles on the Right
$flyerPath = "assets\flyer-dolce-aroma-real-digital.jpg"
if (Test-Path $flyerPath) {
    $flyer = [System.Drawing.Image]::FromFile((Resolve-Path $flyerPath))
    
    $destX = 570
    $destY = 0
    $destW = 630
    $destH = 630
    
    $srcX = 40
    $srcY = 220
    $srcW = 816
    $srcH = [int]($srcW * ($destH / $destW))
    if (($srcY + $srcH) -gt $flyer.Height) {
        $srcH = $flyer.Height - $srcY
    }
    
    $srcRect = [System.Drawing.Rectangle]::new($srcX, $srcY, $srcW, $srcH)
    $destRect = [System.Drawing.Rectangle]::new($destX, $destY, $destW, $destH)
    
    $g.DrawImage($flyer, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $flyer.Dispose()
    
    # Smooth gradient fade from left dark area over the photo left edge
    $fadeBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        ([System.Drawing.Point]::new(560, 0)),
        ([System.Drawing.Point]::new(700, 0)),
        [System.Drawing.Color]::FromArgb(255, 6, 7, 10),
        [System.Drawing.Color]::FromArgb(0, 6, 7, 10)
    )
    $g.FillRectangle($fadeBrush, 560, 0, 140, $height)
    $fadeBrush.Dispose()
}

# 3. Outer Luxury Double Border
$goldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180, 212, 175, 55), 1.5)
$g.DrawRectangle($goldPen, 16, 16, $width - 32, $height - 32)
$thinGoldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, 212, 175, 55), 1.0)
$g.DrawRectangle($thinGoldPen, 22, 22, $width - 44, $height - 44)
$goldPen.Dispose()
$thinGoldPen.Dispose()

# 4. Left Content: Brand & Value Prop
$goldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 230, 195, 100))
$brightGoldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 225, 130))
$whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$lightGrayBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 205, 210, 220))
$emeraldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 52, 211, 153))

# Fonts
$fontTag = [System.Drawing.Font]::new("Arial", [single]10.5, [System.Drawing.FontStyle]::Bold)
$fontH1 = [System.Drawing.Font]::new("Georgia", [single]25, [System.Drawing.FontStyle]::Bold)
$fontSub = [System.Drawing.Font]::new("Arial", [single]12.5, [System.Drawing.FontStyle]::Regular)
$fontPriceTitle = [System.Drawing.Font]::new("Arial", [single]10.5, [System.Drawing.FontStyle]::Bold)
$fontPriceNum = [System.Drawing.Font]::new("Georgia", [single]21, [System.Drawing.FontStyle]::Bold)
$fontPriceLabel = [System.Drawing.Font]::new("Arial", [single]9, [System.Drawing.FontStyle]::Regular)

# A. Gold Logo at Top-Left (X: 52, Y: 42)
$logoPath = "assets\logo-gold-cropped.png"
if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile((Resolve-Path $logoPath))
    $logoW = 210
    $logoH = [int]($logoW * ($logo.Height / $logo.Width))
    $g.DrawImage($logo, 52, 42, $logoW, $logoH)
    $logo.Dispose()
}

# Tagline above headline
$g.DrawString("PERFUMERIA DE AUTOR * INSPIRACIONES DE DISENADOR", $fontTag, $goldBrush, 52, 142)

# Main Headline
$g.DrawString("Fragancias con Fijacion Real", $fontH1, $whiteBrush, 50, 168)
$g.DrawString("de 8 a 12 Horas", $fontH1, $brightGoldBrush, 50, 204)

# Subtitle
$g.DrawString("Maceracion francesa con esencias puras importadas.", $fontSub, $lightGrayBrush, 52, 252)
$g.DrawString("Las mejores equivalencias y dupes premium de Lima.", $fontSub, $lightGrayBrush, 52, 274)

# B. 3 Price Cards (Pocket 10ml S/15, Clasico 50ml S/65, Signature 110ml S/115)
$cardY = 310
$cardH = 86
$cardW = 160
$spacing = 14

$prices = @(
    @{ Name = "POCKET"; Size = "10ml"; Price = "S/ 15"; Sub = "Para llevar" },
    @{ Name = "CLASICO"; Size = "50ml"; Price = "S/ 65"; Sub = "Mas vendido" },
    @{ Name = "SIGNATURE"; Size = "110ml"; Price = "S/ 115"; Sub = "Maxima duracion" }
)

$sfCardCenter = [System.Drawing.StringFormat]::new()
$sfCardCenter.Alignment = [System.Drawing.StringAlignment]::Center
$sfCardCenter.LineAlignment = [System.Drawing.StringAlignment]::Center

for ($i = 0; $i -lt $prices.Count; $i++) {
    $cX = 52 + ($i * ($cardW + $spacing))
    
    # Card Background
    $cardBg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235, 14, 18, 28))
    $g.FillRectangle($cardBg, $cX, $cardY, $cardW, $cardH)
    $cardBg.Dispose()
    
    # Card Border
    $cBorderColor = if ($i -eq 1) { [System.Drawing.Color]::FromArgb(210, 212, 175, 55) } else { [System.Drawing.Color]::FromArgb(90, 212, 175, 55) }
    $cPen = [System.Drawing.Pen]::new($cBorderColor, 1.2)
    $g.DrawRectangle($cPen, $cX, $cardY, $cardW, $cardH)
    $cPen.Dispose()
    
    # Header tag in card
    $g.DrawString("$($prices[$i].Name) ($($prices[$i].Size))", $fontPriceTitle, $goldBrush, ($cX + ($cardW/2)), ($cardY + 18), $sfCardCenter)
    # Price
    $pBrush = if ($i -eq 1) { $brightGoldBrush } else { $whiteBrush }
    $g.DrawString($prices[$i].Price, $fontPriceNum, $pBrush, ($cX + ($cardW/2)), ($cardY + 45), $sfCardCenter)
    # Sub
    $g.DrawString($prices[$i].Sub, $fontPriceLabel, $lightGrayBrush, ($cX + ($cardW/2)), ($cardY + 70), $sfCardCenter)
}

# C. Bottom Trust Badges (Y: 416 - 564)
$badgeBg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 11, 14, 22))
$g.FillRectangle($badgeBg, 52, 416, 508, 148)
$badgeBg.Dispose()

$badgePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(80, 212, 175, 55), 1.0)
$g.DrawRectangle($badgePen, 52, 416, 508, 148)
$badgePen.Dispose()

# Trust items
$fontBTitle = [System.Drawing.Font]::new("Arial", [single]10.5, [System.Drawing.FontStyle]::Bold)
$fontBSub = [System.Drawing.Font]::new("Arial", [single]9.5, [System.Drawing.FontStyle]::Regular)

# Bullet 1: Delivery
$g.DrawString("+ DELIVERY GRATIS en Lima Metropolitana", $fontBTitle, $whiteBrush, 68, 432)
$g.DrawString("Por compras desde S/ 100 con entrega rapida y segura a domicilio", $fontBSub, $lightGrayBrush, 68, 452)

# Divider
$divPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(40, 255, 255, 255), 1.0)
$g.DrawLine($divPen, 68, 478, 542, 478)
$divPen.Dispose()

# Bullet 2: Payments & Pickup
$g.DrawString("+ PAGOS SEGUROS: Tarjetas (Mercado Pago), Yape y Plin", $fontBTitle, $emeraldBrush, 68, 492)
$g.DrawString("Punto de Recojo en SMP: Jr. Callao 482-A (Bazar Shirley)", $fontBSub, $lightGrayBrush, 68, 514)

# Quality encoder params for crisp JPEG
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoderParams = [System.Drawing.Imaging.EncoderParameters]::new(1)
$encoderParams.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]95)

# Save Outputs
$bmp.Save("assets\og-cover-dolce7aroma.jpg", $codec, $encoderParams)
$bmp.Save("assets\frascos-dolcearoma.jpg", $codec, $encoderParams)

Write-Host "Generated assets\og-cover-dolce7aroma.jpg & updated assets\frascos-dolcearoma.jpg"

$bmp.Dispose()
$g.Dispose()
