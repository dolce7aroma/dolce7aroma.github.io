[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

$width = 1200
$height = 630

$bmp = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# 1. Base luxury gradient: Pearl white at left (X=0) to studio neutral grey at right (X=1200)
$bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    ([System.Drawing.Point]::new(0, 0)),
    ([System.Drawing.Point]::new($width, 0)),
    [System.Drawing.Color]::FromArgb(255, 253, 253, 254),
    [System.Drawing.Color]::FromArgb(255, 188, 189, 192)
)
$g.FillRectangle($bgBrush, 0, 0, $width, $height)
$bgBrush.Dispose()

# 2. Prepare the render with alpha fade on its left edge
$renderSrc = [System.Drawing.Bitmap]::FromFile((Resolve-Path "assets\frascos-dolcearoma-render.png"))
$rw = $renderSrc.Width
$rh = $renderSrc.Height

# Scaled dimensions for height = 630
$destH = 630
$destW = [int]($destH * ($rw / $rh)) # 758
# Shift 30px right so bottles have maximum breathing room (bottles start around X=555)
$destX = $width - $destW + 35 # ~ 477

# Create a copy of the render with alpha fade on left 220px
$fadedRender = [System.Drawing.Bitmap]::new($rw, $rh, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$fadeWidth = 240 # In native render coordinates

for ($y = 0; $y -lt $rh; $y++) {
    for ($x = 0; $x -lt $rw; $x++) {
        $p = $renderSrc.GetPixel($x, $y)
        if ($x -lt $fadeWidth) {
            $t = $x / [double]$fadeWidth
            $alpha = [int](255 * ($t * $t * (3 - 2 * $t)))
            $fadedRender.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
        } else {
            $fadedRender.SetPixel($x, $y, $p)
        }
    }
}
$renderSrc.Dispose()

# Draw the faded render onto the canvas
$g.DrawImage($fadedRender, [System.Drawing.Rectangle]::new($destX, 0, $destW, $destH))
$fadedRender.Dispose()

# 3. Outer Luxury Double Framing Border (Clean dark graphite)
$borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150, 20, 24, 30), 1.2)
$g.DrawRectangle($borderPen, 22, 22, $width - 44, $height - 44)
$thinBorderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(45, 20, 24, 30), 0.8)
$g.DrawRectangle($thinBorderPen, 28, 28, $width - 56, $height - 56)
$borderPen.Dispose()
$thinBorderPen.Dispose()

# 4. Draw Official Pure Black Logo (Transparent PNG)
$logo = [System.Drawing.Bitmap]::FromFile((Resolve-Path "assets\logo-clean-black.png"))
# Logo is 312 x 150. Draw it at X=70, Y=45, size 335 x 161
$logoW = 335
$logoH = [int]($logoW * ($logo.Height / $logo.Width))
$g.DrawImage($logo, 70, 45, $logoW, $logoH)
$logo.Dispose()

# 5. Brushes
$blackBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 12, 14, 18))
$charcoalBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 50, 55, 65))
$mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 90, 95, 105))
$goldAccent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 150, 115, 65))

# 6. Fonts (Large, bold, high-fashion)
$fontTag = [System.Drawing.Font]::new("Arial", [single]11.5, [System.Drawing.FontStyle]::Bold)
$fontH1 = [System.Drawing.Font]::new("Georgia", [single]27.5, [System.Drawing.FontStyle]::Bold)
$fontBody = [System.Drawing.Font]::new("Arial", [single]13, [System.Drawing.FontStyle]::Regular)
$fontBoxTitle = [System.Drawing.Font]::new("Arial", [single]11, [System.Drawing.FontStyle]::Bold)
$fontBoxSub = [System.Drawing.Font]::new("Arial", [single]10.5, [System.Drawing.FontStyle]::Regular)

# A. Category Tag
$g.DrawString("ALTA PERFUMERÍA · INSPIRACIONES DE DISEÑADOR", $fontTag, $goldAccent, 72, 224)

# B. Main Prestige Headline (Clean 2 lines, strictly under 460px width to avoid bottles)
$g.DrawString("Fragancias con Fijación Real", $fontH1, $blackBrush, 70, 252)
$g.DrawString("de 8 a 12 Horas", $fontH1, $blackBrush, 70, 292)

# C. Refined Description (Brand Presentation - NO prices)
$g.DrawString("Maceración francesa con esencias puras importadas.", $fontBody, $charcoalBrush, 72, 348)
$g.DrawString("Formuladas para brindar máxima estela, proyección y elegancia.", $fontBody, $charcoalBrush, 72, 372)
$g.DrawString("Presentaciones exclusivas en frascos de 10ml, 50ml y 110ml.", $fontBody, $charcoalBrush, 72, 396)

# D. Presentation Box (Physical Store & Digital Boutique)
$boxY = 448
$boxW = 465
$boxH = 124
$boxBg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(215, 255, 255, 255))
$g.FillRectangle($boxBg, 70, $boxY, $boxW, $boxH)
$boxBg.Dispose()

$boxPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(120, 150, 115, 65), 1.0)
$g.DrawRectangle($boxPen, 70, $boxY, $boxW, $boxH)
$boxPen.Dispose()

# Row 1: Physical Pickup
$g.DrawString("TIENDA & PUNTO DE RECOJO", $fontBoxTitle, $blackBrush, 86, ($boxY + 16))
$g.DrawString("Jr. Callao 482-A, San Martín de Porres (Bazar Shirley) · Lima", $fontBoxSub, $mutedBrush, 86, ($boxY + 36))

# Divider line
$divPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(55, 150, 115, 65), 1.0)
$g.DrawLine($divPen, 86, ($boxY + 62), ($boxW + 48), ($boxY + 62))
$divPen.Dispose()

# Row 2: Digital Boutique & WhatsApp
$g.DrawString("BOUTIQUE DIGITAL & ATENCIÓN", $fontBoxTitle, $blackBrush, 86, ($boxY + 74))
$g.DrawString("www.dolce7aroma.com   ·   WhatsApp: +51 930 122 014", $fontBoxSub, $mutedBrush, 86, ($boxY + 94))

# 7. Save outputs
$brain = Join-Path $env:USERPROFILE ".gemini\antigravity\brain\7b894607-11dd-48a6-8997-4fe78cfe89be"

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoderParams = [System.Drawing.Imaging.EncoderParameters]::new(1)
$encoderParams.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]96)

$bmp.Save("assets\og-cover-dolce7aroma.jpg", $codec, $encoderParams)
$bmp.Save("assets\frascos-dolcearoma.jpg", $codec, $encoderParams)
$bmp.Save((Join-Path $brain "og-cover-dolce7aroma.jpg"), $codec, $encoderParams)

Write-Host "PERFECT_BRAND_CARD_GENERATED_SUCCESSFULLY"

$bmp.Dispose()
$g.Dispose()
