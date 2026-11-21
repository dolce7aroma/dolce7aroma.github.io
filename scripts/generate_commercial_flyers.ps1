Add-Type -AssemblyName System.Drawing

$logoGoldPath = "assets\logo-gold-cropped.png"
$sourceImgPath = "assets\flyer-dolce-aroma-real-digital.jpg"

# 1. MASTER FLYER (1080 x 1440)
function Generate-MasterFlyer {
    param([string]$outputPath = "assets\flyer-precios-dolce7aroma.jpg")

    $width = 1080
    $height = 1440
    $src = [System.Drawing.Image]::FromFile((Resolve-Path $sourceImgPath))
    $bmp = [System.Drawing.Bitmap]::new($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)

    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # Dark background
    $bgBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 7, 9, 11))
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)
    $bgBrush.Dispose()

    # Draw centered source image
    $scaleW = $width
    $scaleH = [int]($width * ($src.Height / $src.Width))
    $posY = 130
    $g.DrawImage($src, 0, $posY, $scaleW, $scaleH)
    $src.Dispose()

    # Top overlay
    $topFade = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        ([System.Drawing.Point]::new(0, 0)),
        ([System.Drawing.Point]::new(0, 260)),
        [System.Drawing.Color]::FromArgb(252, 6, 8, 10),
        [System.Drawing.Color]::FromArgb(0, 6, 8, 10)
    )
    $g.FillRectangle($topFade, 0, 0, $width, 260)
    $topFade.Dispose()

    # Bottom overlay
    $botFade = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        ([System.Drawing.Point]::new(0, 930)),
        ([System.Drawing.Point]::new(0, 1140)),
        [System.Drawing.Color]::FromArgb(0, 6, 8, 10),
        [System.Drawing.Color]::FromArgb(252, 6, 8, 10)
    )
    $g.FillRectangle($botFade, 0, 930, $width, 210)
    $botFade.Dispose()

    $botSolid = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(252, 6, 8, 10))
    $g.FillRectangle($botSolid, 0, 1140, $width, ($height - 1140))
    $botSolid.Dispose()

    # Borders
    $goldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180, 212, 175, 55), 2.0)
    $g.DrawRectangle($goldPen, 18, 18, $width - 36, $height - 36)
    $thinGoldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(80, 212, 175, 55), 1.0)
    $g.DrawRectangle($thinGoldPen, 24, 24, $width - 48, $height - 48)
    $goldPen.Dispose()
    $thinGoldPen.Dispose()

    # Fonts
    $fontTopTag = [System.Drawing.Font]::new("Arial", [single]11, [System.Drawing.FontStyle]::Bold)
    $fontSub = [System.Drawing.Font]::new("Arial", [single]13, [System.Drawing.FontStyle]::Bold)
    $fontBadgeTitle = [System.Drawing.Font]::new("Arial", [single]12, [System.Drawing.FontStyle]::Bold)
    $fontPrice = [System.Drawing.Font]::new("Georgia", [single]26, [System.Drawing.FontStyle]::Bold)
    $fontDetail = [System.Drawing.Font]::new("Arial", [single]10, [System.Drawing.FontStyle]::Regular)
    $fontPromoTitle = [System.Drawing.Font]::new("Georgia", [single]17, [System.Drawing.FontStyle]::Bold)
    $fontPromoText = [System.Drawing.Font]::new("Arial", [single]14, [System.Drawing.FontStyle]::Bold)
    $fontFooter = [System.Drawing.Font]::new("Arial", [single]12, [System.Drawing.FontStyle]::Regular)
    $fontFooterBold = [System.Drawing.Font]::new("Arial", [single]14, [System.Drawing.FontStyle]::Bold)

    $goldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 230, 195, 100))
    $brightGoldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 225, 130))
    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $lightGrayBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 215, 220, 225))
    $greenEmeraldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 46, 204, 113))

    $sfCenter = [System.Drawing.StringFormat]::new()
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Top Tag
    $g.DrawString("PERFUMERIA DE ALTA GAMA  *  FRAGANCIAS QUE CAUTIVAN", $fontTopTag, $goldBrush, [float]($width / 2), 40, $sfCenter)

    # Gold Logo (W=240, H=117) at Y=60
    if (Test-Path $logoGoldPath) {
        $logoSrc = [System.Drawing.Image]::FromFile((Resolve-Path $logoGoldPath))
        $logoW = 240
        $logoH = [int]($logoW * ($logoSrc.Height / $logoSrc.Width))
        $g.DrawImage($logoSrc, [int](($width - $logoW)/2), 60, $logoW, $logoH)
        $logoSrc.Dispose()
    }

    # Text placed at Y=192 cleanly below logo
    $g.DrawString("LISTA OFICIAL DE PRECIOS & PRESENTACIONES", $fontSub, $whiteBrush, [float]($width / 2), 192, $sfCenter)

    function Draw-CardBadge {
        param($x, $y, $w, $h, $title, $price, $subtitle, $accentColor, $lineStartX, $lineStartY, $lineEndX, $lineEndY)
        
        if ($lineStartX -ne $null) {
            $ptrPen = [System.Drawing.Pen]::new($accentColor, 1.5)
            $g.DrawLine($ptrPen, [float]$lineStartX, [float]$lineStartY, [float]$lineEndX, [float]$lineEndY)
            $dotBrush = [System.Drawing.SolidBrush]::new($accentColor)
            $g.FillEllipse($dotBrush, ($lineEndX - 4), ($lineEndY - 4), 8, 8)
            $dotBrush.Dispose()
            $ptrPen.Dispose()
        }

        $rect = [System.Drawing.Rectangle]::new($x, $y, $w, $h)
        $shadowRect = [System.Drawing.Rectangle]::new(($x+4), ($y+4), $w, $h)
        $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(160, 0, 0, 0))
        $g.FillRectangle($shadowBrush, $shadowRect)
        $shadowBrush.Dispose()

        $cardBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 12, 16, 20))
        $g.FillRectangle($cardBrush, $rect)
        $cardBrush.Dispose()

        $cardPen = [System.Drawing.Pen]::new($accentColor, 2.0)
        $g.DrawRectangle($cardPen, $rect)
        $cardPen.Dispose()

        $accBrush = [System.Drawing.SolidBrush]::new($accentColor)
        $g.DrawString($title, $fontBadgeTitle, $accBrush, [float]($x + $w/2), [float]($y + 20), $sfCenter)
        $accBrush.Dispose()

        $g.DrawString($price, $fontPrice, $brightGoldBrush, [float]($x + $w/2), [float]($y + 48), $sfCenter)
        $g.DrawString($subtitle, $fontDetail, $lightGrayBrush, [float]($x + $w/2), [float]($y + 75), $sfCenter)
    }

    # 1. 10ml Pocket (Y=430)
    Draw-CardBadge 35 430 190 98 "10 ML POCKET" "S/ 20" "3x S/ 50 (Amigo Secreto)" ([System.Drawing.Color]::FromArgb(255, 70, 175, 255)) 130 528 130 565

    # 2. 50ml Clásico (Y=350)
    Draw-CardBadge 265 350 195 98 "50 ML CLASICO" "S/ 55" "Incluye 2 Probadores" ([System.Drawing.Color]::FromArgb(255, 46, 204, 113)) 362 448 362 490

    # 3. 110ml Signature (Y=245)
    Draw-CardBadge 535 245 215 98 "110 ML SIGNATURE" "S/ 90" "+ 10ml Gratis y Probadores" ([System.Drawing.Color]::FromArgb(255, 230, 195, 100)) 642 343 642 390

    # 4. Bolsa Metalizada
    $bagRect = [System.Drawing.Rectangle]::new(800, 360, 240, 92)
    $shadowBag = [System.Drawing.Rectangle]::new(804, 364, 240, 92)
    $shadowBrushBag = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(160, 0, 0, 0))
    $g.FillRectangle($shadowBrushBag, $shadowBag)
    $shadowBrushBag.Dispose()

    $cardBrushBag = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 22, 18, 12))
    $g.FillRectangle($cardBrushBag, $bagRect)
    $cardBrushBag.Dispose()
    $cardPenBag = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 212, 175, 55), 2.0)
    $g.DrawRectangle($cardPenBag, $bagRect)
    $cardPenBag.Dispose()
    $g.DrawString("BOLSA METALIZADA", $fontBadgeTitle, $goldBrush, [float](800 + 120), [float](360 + 26), $sfCenter)
    $g.DrawString("INCLUIDA GRATIS", $fontPromoTitle, $whiteBrush, [float](800 + 120), [float](360 + 58), $sfCenter)

    # --- COMBOS BANNER ---
    $bannerY = 1040
    $bannerH = 150
    $bannerRect = [System.Drawing.Rectangle]::new(40, $bannerY, ($width - 80), $bannerH)

    $banBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        ([System.Drawing.Point]::new(40, $bannerY)),
        ([System.Drawing.Point]::new(($width - 40), ($bannerY + $bannerH))),
        [System.Drawing.Color]::FromArgb(245, 24, 20, 14),
        [System.Drawing.Color]::FromArgb(245, 12, 28, 22)
    )
    $g.FillRectangle($banBrush, $bannerRect)
    $banBrush.Dispose()

    $banPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 212, 175, 55), 2.0)
    $g.DrawRectangle($banPen, $bannerRect)
    $banPen.Dispose()

    $g.DrawString("COMBOS ESPECIALES & ENVIO GRATIS LIMA", $fontPromoTitle, $brightGoldBrush, [float]($width / 2), ($bannerY + 28), $sfCenter)

    $c1X = 200; $c2X = 540; $c3X = 880
    $g.DrawString("3x 10ml Pocket", $fontPromoText, $whiteBrush, [float]$c1X, ($bannerY + 68), $sfCenter)
    $g.DrawString("S/ 50", $fontPrice, $greenEmeraldBrush, [float]$c1X, ($bannerY + 98), $sfCenter)
    $g.DrawString("Ideal Amigo Secreto", $fontDetail, $lightGrayBrush, [float]$c1X, ($bannerY + 124), $sfCenter)

    $g.DrawString("2x 50ml Clasico", $fontPromoText, $whiteBrush, [float]$c2X, ($bannerY + 68), $sfCenter)
    $g.DrawString("S/ 100", $fontPrice, $greenEmeraldBrush, [float]$c2X, ($bannerY + 98), $sfCenter)
    $g.DrawString("Envio Gratis Lima", $fontDetail, $goldBrush, [float]$c2X, ($bannerY + 124), $sfCenter)

    $g.DrawString("3x 110ml Signature", $fontPromoText, $whiteBrush, [float]$c3X, ($bannerY + 68), $sfCenter)
    $g.DrawString("S/ 225", $fontPrice, $greenEmeraldBrush, [float]$c3X, ($bannerY + 98), $sfCenter)
    $g.DrawString("Envio Gratis Lima", $fontDetail, $goldBrush, [float]$c3X, ($bannerY + 124), $sfCenter)

    # --- FOOTER ---
    $footY = 1220
    $g.DrawString("Punto de Retiro: Jr. Callao 482-A, SMP (Bazar Shirley)", $fontFooterBold, $whiteBrush, [float]($width / 2), $footY, $sfCenter)
    $g.DrawString("Envios Express en Lima y a Todo el Peru * Yape, Plin y Transferencias", $fontFooter, $lightGrayBrush, [float]($width / 2), ($footY + 26), $sfCenter)

    $ctaRect = [System.Drawing.Rectangle]::new(180, ($footY + 58), ($width - 360), 68)
    $ctaBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 18, 140, 75))
    $g.FillRectangle($ctaBrush, $ctaRect)
    $ctaBrush.Dispose()
    $ctaBorderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 37, 211, 102), 2.0)
    $g.DrawRectangle($ctaBorderPen, $ctaRect)
    $ctaBorderPen.Dispose()

    $g.DrawString("WHATSAPP PEDIDOS: 930 122 014", $fontFooterBold, $whiteBrush, [float]($width / 2), ($footY + 84), $sfCenter)
    $g.DrawString("Catalogo online: dolce7aroma.com", $fontDetail, ([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 255, 255, 255))), [float]($width / 2), ($footY + 108), $sfCenter)

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Master flyer saved: $outputPath"
}

# 2. STORY FLYER (1080 x 1920)
function Generate-StoryFlyer {
    param([string]$outputPath = "assets\story-precios-dolce7aroma.jpg")

    $width = 1080
    $height = 1920
    $src = [System.Drawing.Image]::FromFile((Resolve-Path $sourceImgPath))
    $bmp = [System.Drawing.Bitmap]::new($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)

    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    $bgBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 7, 9, 11))
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)
    $bgBrush.Dispose()

    $scaleW = $width
    $scaleH = [int]($width * ($src.Height / $src.Width))
    $posY = 360
    $g.DrawImage($src, 0, $posY, $scaleW, $scaleH)
    $src.Dispose()

    $topFade = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        ([System.Drawing.Point]::new(0, 0)),
        ([System.Drawing.Point]::new(0, 480)),
        [System.Drawing.Color]::FromArgb(255, 6, 8, 10),
        [System.Drawing.Color]::FromArgb(0, 6, 8, 10)
    )
    $g.FillRectangle($topFade, 0, 0, $width, 480)
    $topFade.Dispose()

    $botFade = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        ([System.Drawing.Point]::new(0, 1300)),
        ([System.Drawing.Point]::new(0, 1500)),
        [System.Drawing.Color]::FromArgb(0, 6, 8, 10),
        [System.Drawing.Color]::FromArgb(255, 6, 8, 10)
    )
    $g.FillRectangle($botFade, 0, 1300, $width, 200)
    $botFade.Dispose()

    $botSolid = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 6, 8, 10))
    $g.FillRectangle($botSolid, 0, 1500, $width, ($height - 1500))
    $botSolid.Dispose()

    $goldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(180, 212, 175, 55), 2.0)
    $g.DrawRectangle($goldPen, 24, 24, $width - 48, $height - 48)
    $goldPen.Dispose()

    $fontTopTag = [System.Drawing.Font]::new("Arial", [single]13, [System.Drawing.FontStyle]::Bold)
    $fontSub = [System.Drawing.Font]::new("Arial", [single]16, [System.Drawing.FontStyle]::Bold)
    $fontBadgeTitle = [System.Drawing.Font]::new("Arial", [single]13, [System.Drawing.FontStyle]::Bold)
    $fontPrice = [System.Drawing.Font]::new("Georgia", [single]30, [System.Drawing.FontStyle]::Bold)
    $fontDetail = [System.Drawing.Font]::new("Arial", [single]12, [System.Drawing.FontStyle]::Regular)
    $fontPromoTitle = [System.Drawing.Font]::new("Georgia", [single]22, [System.Drawing.FontStyle]::Bold)
    $fontPromoText = [System.Drawing.Font]::new("Arial", [single]16, [System.Drawing.FontStyle]::Bold)
    $fontFooter = [System.Drawing.Font]::new("Arial", [single]14, [System.Drawing.FontStyle]::Regular)
    $fontFooterBold = [System.Drawing.Font]::new("Arial", [single]17, [System.Drawing.FontStyle]::Bold)

    $goldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 230, 195, 100))
    $brightGoldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 225, 130))
    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $lightGrayBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 215, 220, 225))
    $greenEmeraldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 46, 204, 113))

    $sfCenter = [System.Drawing.StringFormat]::new()
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
    $sfCenter.LineAlignment = [System.Drawing.StringAlignment]::Center

    $g.DrawString("PERFUMERIA DE ALTA GAMA * SMP - LIMA", $fontTopTag, $goldBrush, [float]($width / 2), 65, $sfCenter)

    if (Test-Path $logoGoldPath) {
        $logoSrc = [System.Drawing.Image]::FromFile((Resolve-Path $logoGoldPath))
        $logoW = 300
        $logoH = [int]($logoW * ($logoSrc.Height / $logoSrc.Width))
        $g.DrawImage($logoSrc, [int](($width - $logoW)/2), 95, $logoW, $logoH)
        $logoSrc.Dispose()
    }

    $g.DrawString("LISTA OFICIAL DE PRECIOS 2026", $fontSub, $whiteBrush, [float]($width / 2), 260, $sfCenter)
    $g.DrawString("Fragancias que cautivan con la mayor fijacion", $fontDetail, $goldBrush, [float]($width / 2), 295, $sfCenter)

    function Draw-StoryBadge {
        param($x, $y, $w, $h, $title, $price, $subtitle, $accentColor)
        $rect = [System.Drawing.Rectangle]::new($x, $y, $w, $h)
        $shadowRect = [System.Drawing.Rectangle]::new(($x+4), ($y+4), $w, $h)
        $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(160, 0, 0, 0))
        $g.FillRectangle($shadowBrush, $shadowRect)
        $shadowBrush.Dispose()

        $cardBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 12, 16, 20))
        $g.FillRectangle($cardBrush, $rect)
        $cardBrush.Dispose()

        $cardPen = [System.Drawing.Pen]::new($accentColor, 2.0)
        $g.DrawRectangle($cardPen, $rect)
        $cardPen.Dispose()

        $accBrush = [System.Drawing.SolidBrush]::new($accentColor)
        $g.DrawString($title, $fontBadgeTitle, $accBrush, [float]($x + $w/2), [float]($y + 22), $sfCenter)
        $accBrush.Dispose()

        $g.DrawString($price, $fontPrice, $brightGoldBrush, [float]($x + $w/2), [float]($y + 54), $sfCenter)
        $g.DrawString($subtitle, $fontDetail, $lightGrayBrush, [float]($x + $w/2), [float]($y + 84), $sfCenter)
    }

    Draw-StoryBadge 40 600 210 110 "10 ML POCKET" "S/ 20" "3x S/ 50 Amigo Secreto" ([System.Drawing.Color]::FromArgb(255, 70, 175, 255))
    Draw-StoryBadge 275 520 220 110 "50 ML CLASICO" "S/ 55" "Incluye 2 Probadores" ([System.Drawing.Color]::FromArgb(255, 46, 204, 113))
    Draw-StoryBadge 540 440 240 110 "110 ML SIGNATURE" "S/ 90" "+ 10ml y Probadores Gratis" ([System.Drawing.Color]::FromArgb(255, 230, 195, 100))

    $bagRect = [System.Drawing.Rectangle]::new(810, 540, 230, 100)
    $cardBrushBag = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 22, 18, 12))
    $g.FillRectangle($cardBrushBag, $bagRect)
    $cardBrushBag.Dispose()
    $cardPenBag = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 212, 175, 55), 2.0)
    $g.DrawRectangle($cardPenBag, $bagRect)
    $cardPenBag.Dispose()
    $g.DrawString("BOLSA METALIZADA", $fontBadgeTitle, $goldBrush, [float](810 + 115), [float](540 + 30), $sfCenter)
    $g.DrawString("INCLUIDA GRATIS", $fontPromoTitle, $whiteBrush, [float](810 + 115), [float](540 + 66), $sfCenter)

    $bannerY = 1420
    $bannerH = 200
    $bannerRect = [System.Drawing.Rectangle]::new(40, $bannerY, ($width - 80), $bannerH)

    $banBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        ([System.Drawing.Point]::new(40, $bannerY)),
        ([System.Drawing.Point]::new(($width - 40), ($bannerY + $bannerH))),
        [System.Drawing.Color]::FromArgb(245, 24, 20, 14),
        [System.Drawing.Color]::FromArgb(245, 12, 28, 22)
    )
    $g.FillRectangle($banBrush, $bannerRect)
    $banBrush.Dispose()

    $banPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 212, 175, 55), 2.0)
    $g.DrawRectangle($banPen, $bannerRect)
    $banPen.Dispose()

    $g.DrawString("COMBOS CON ENVIO GRATIS LIMA", $fontPromoTitle, $brightGoldBrush, [float]($width / 2), ($bannerY + 35), $sfCenter)

    $c1X = 200; $c2X = 540; $c3X = 880
    $g.DrawString("3x 10ml Pocket", $fontPromoText, $whiteBrush, [float]$c1X, ($bannerY + 85), $sfCenter)
    $g.DrawString("S/ 50", $fontPrice, $greenEmeraldBrush, [float]$c1X, ($bannerY + 125), $sfCenter)
    $g.DrawString("Ideal Amigo Secreto", $fontDetail, $lightGrayBrush, [float]$c1X, ($bannerY + 160), $sfCenter)

    $g.DrawString("2x 50ml Clasico", $fontPromoText, $whiteBrush, [float]$c2X, ($bannerY + 85), $sfCenter)
    $g.DrawString("S/ 100", $fontPrice, $greenEmeraldBrush, [float]$c2X, ($bannerY + 125), $sfCenter)
    $g.DrawString("Envio Gratis Lima", $fontDetail, $goldBrush, [float]$c2X, ($bannerY + 160), $sfCenter)

    $g.DrawString("3x 110ml Signature", $fontPromoText, $whiteBrush, [float]$c3X, ($bannerY + 85), $sfCenter)
    $g.DrawString("S/ 225", $fontPrice, $greenEmeraldBrush, [float]$c3X, ($bannerY + 125), $sfCenter)
    $g.DrawString("Envio Gratis Lima", $fontDetail, $goldBrush, [float]$c3X, ($bannerY + 160), $sfCenter)

    $footY = 1660
    $g.DrawString("Punto de Retiro: Jr. Callao 482-A, SMP (Bazar Shirley)", $fontFooterBold, $whiteBrush, [float]($width / 2), $footY, $sfCenter)
    $g.DrawString("Envios Express en Lima y a Todo el Peru * Yape, Plin y Transferencias", $fontFooter, $lightGrayBrush, [float]($width / 2), ($footY + 32), $sfCenter)

    $ctaRect = [System.Drawing.Rectangle]::new(140, ($footY + 75), ($width - 280), 85)
    $ctaBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 18, 140, 75))
    $g.FillRectangle($ctaBrush, $ctaRect)
    $ctaBrush.Dispose()
    $ctaBorderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 37, 211, 102), 2.0)
    $g.DrawRectangle($ctaBorderPen, $ctaRect)
    $ctaBorderPen.Dispose()

    $g.DrawString("WHATSAPP PEDIDOS: 930 122 014", $fontFooterBold, $whiteBrush, [float]($width / 2), ($footY + 107), $sfCenter)
    $g.DrawString("Visitanos en: dolce7aroma.com", $fontDetail, ([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 255, 255, 255))), [float]($width / 2), ($footY + 137), $sfCenter)

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Story flyer saved: $outputPath"
}

# Run generation
Generate-MasterFlyer
Generate-StoryFlyer
