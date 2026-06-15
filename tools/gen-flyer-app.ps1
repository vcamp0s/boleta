# Gera boleta-app-instalar.png — folheto UNICO (Android + iPhone) para WhatsApp.
# QR aponta para a pagina /app, onde a pessoa escolhe o aparelho e ve o passo a passo certo.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$W = 1080; $H = 1580
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$cNeon = [System.Drawing.Color]::FromArgb(40,224,255)
$cText = [System.Drawing.Color]::FromArgb(232,240,255)
$cDim  = [System.Drawing.Color]::FromArgb(138,160,200)
$cLine = [System.Drawing.Color]::FromArgb(29,44,82)
$cWarn = [System.Drawing.Color]::FromArgb(255,207,92)
$bNeon = New-Object System.Drawing.SolidBrush($cNeon)
$bText = New-Object System.Drawing.SolidBrush($cText)
$bDim  = New-Object System.Drawing.SolidBrush($cDim)
$bWarn = New-Object System.Drawing.SolidBrush($cWarn)
$bChip = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30,40,224,255))
$bWhite= New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

$rectFull = New-Object System.Drawing.Rectangle(0,0,$W,$H)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rectFull,
  [System.Drawing.Color]::FromArgb(16,28,58), [System.Drawing.Color]::FromArgb(7,11,22), 60)
$g.FillRectangle($grad, $rectFull)

function New-Font($size,$bold){
  $style = if($bold){[System.Drawing.FontStyle]::Bold}else{[System.Drawing.FontStyle]::Regular}
  New-Object System.Drawing.Font("Segoe UI",[single]$size,$style)
}
$sfC = New-Object System.Drawing.StringFormat; $sfC.Alignment=[System.Drawing.StringAlignment]::Center
$sfM = New-Object System.Drawing.StringFormat
$sfM.Alignment=[System.Drawing.StringAlignment]::Center; $sfM.LineAlignment=[System.Drawing.StringAlignment]::Center
function Text-C($t,$y,$font,$brush){ $g.DrawString($t,$font,$brush,(New-Object System.Drawing.RectangleF(0,$y,$W,80)),$sfC) }
function Text-In($t,$x,$y,$w,$h,$font,$brush){ $g.DrawString($t,$font,$brush,(New-Object System.Drawing.RectangleF($x,$y,$w,$h)),$sfM) }
function Round($x,$y,$w,$h,$r,$brush,$pen){
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $d=$r*2
  $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90); $p.CloseFigure()
  if($brush){$g.FillPath($brush,$p)}; if($pen){$g.DrawPath($pen,$p)}
}

$logoPath = Join-Path $root 'icons\icon-512-2.png'
$logo = [System.Drawing.Image]::FromFile($logoPath)
$g.DrawImage($logo, 440, 56, 200, 200)
$logo.Dispose()

Text-C 'BOLETA' 286 (New-Font 60 $true) $bNeon
Text-C 'Controle Financeiro' 372 (New-Font 26 $false) $bDim
Text-C 'INSTALE NO SEU CELULAR' 432 (New-Font 30 $true) $bText

$penNeon = New-Object System.Drawing.Pen($cNeon, 2)
Round 220 498 640 64 26 $null $penNeon
Text-C 'vcamp0s.github.io/boleta/app' 512 (New-Font 27 $true) $bNeon

$qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=https%3A%2F%2Fvcamp0s.github.io%2Fboleta%2Fapp%2F'
$qrTmp = Join-Path $env:TEMP 'boleta-uni-qr.png'
Invoke-WebRequest -Uri $qrUrl -OutFile $qrTmp -TimeoutSec 25
Round 380 596 320 320 18 $bWhite $null
$qr = [System.Drawing.Image]::FromFile($qrTmp)
$g.DrawImage($qr, 400, 616, 280, 280)
$qr.Dispose()
Text-C 'Aponte a câmera do celular para o QR' 936 (New-Font 23 $false) $bDim

$penLine = New-Object System.Drawing.Pen($cLine, 1)
$g.DrawLine($penLine, 120, 996, 960, 996)

# seletor (ilustrativo) — na pagina a pessoa escolhe o aparelho
Text-C 'NA PÁGINA, ESCOLHA O SEU APARELHO' 1024 (New-Font 27 $true) $bNeon
Round 270 1098 240 66 24 $bChip $penNeon
Text-In 'Android' 270 1098 240 66 (New-Font 25 $true) $bText
Round 570 1098 240 66 24 $bChip $penNeon
Text-In 'iPhone' 570 1098 240 66 (New-Font 25 $true) $bText
Text-C 'e siga o passo a passo certo do seu sistema.' 1186 (New-Font 23 $false) $bDim

# nota: iPhone precisa do Safari
Round 120 1258 840 98 18 $null (New-Object System.Drawing.Pen($cWarn, 2))
Text-In 'iPhone: faça pelo Safari. Se abriu pelo WhatsApp,' 140 1258 800 50 (New-Font 22 $false) $bWarn
Text-In 'toque em (•••) e "Abrir no Safari" antes.' 140 1304 800 50 (New-Font 22 $false) $bWarn

$g.DrawLine($penLine, 120, 1418, 960, 1418)
Text-C 'Grátis  •  Android e iPhone  •  Protegido por PIN' 1442 (New-Font 22 $false) $bDim
Text-C 'Erros ou bugs?  WhatsApp (11) 93295-5199' 1498 (New-Font 23 $true) $bNeon

$out = Join-Path $root 'boleta-app-instalar.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"folheto gerado: $out"
