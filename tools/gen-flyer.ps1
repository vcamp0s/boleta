# Gera boleta-instalar.png — folheto para compartilhar no WhatsApp.
# Usa a logo do app + um QR Code (baixado de api.qrserver.com) apontando para o app.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$W = 1080; $H = 1580
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# cores
$cNeon = [System.Drawing.Color]::FromArgb(40,224,255)
$cText = [System.Drawing.Color]::FromArgb(232,240,255)
$cDim  = [System.Drawing.Color]::FromArgb(138,160,200)
$cLine = [System.Drawing.Color]::FromArgb(29,44,82)
$bNeon = New-Object System.Drawing.SolidBrush($cNeon)
$bText = New-Object System.Drawing.SolidBrush($cText)
$bDim  = New-Object System.Drawing.SolidBrush($cDim)
$bWhite= New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

# fundo gradiente
$rectFull = New-Object System.Drawing.Rectangle(0,0,$W,$H)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rectFull,
  [System.Drawing.Color]::FromArgb(16,28,58), [System.Drawing.Color]::FromArgb(7,11,22), 60)
$g.FillRectangle($grad, $rectFull)

function New-Font($size,$bold){
  $style = if($bold){[System.Drawing.FontStyle]::Bold}else{[System.Drawing.FontStyle]::Regular}
  New-Object System.Drawing.Font("Segoe UI",[single]$size,$style)
}
$sfC = New-Object System.Drawing.StringFormat; $sfC.Alignment=[System.Drawing.StringAlignment]::Center
function Text-C($t,$y,$font,$brush){ $g.DrawString($t,$font,$brush,(New-Object System.Drawing.RectangleF(0,$y,$W,80)),$sfC) }
function Text-L($t,$x,$y,$font,$brush){ $g.DrawString($t,$font,$brush,[single]$x,[single]$y) }
function Round($x,$y,$w,$h,$r,$brush,$pen){
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $d=$r*2
  $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90); $p.CloseFigure()
  if($brush){$g.FillPath($brush,$p)}; if($pen){$g.DrawPath($pen,$p)}
}

# logo do app
$logoPath = Join-Path $root 'icons\icon-512.png'
$logo = [System.Drawing.Image]::FromFile($logoPath)
$g.DrawImage($logo, 440, 56, 200, 200)
$logo.Dispose()

# titulo
Text-C 'BOLETA' 286 (New-Font 60 $true) $bNeon
Text-C 'Controle financeiro da semana' 372 (New-Font 26 $false) $bDim
Text-C 'COMO INSTALAR NO CELULAR' 432 (New-Font 30 $true) $bText

# pill com o link
$penNeon = New-Object System.Drawing.Pen($cNeon, 2)
Round 200 498 680 64 26 $null $penNeon
Text-C 'vcamp0s.github.io/boleta' 512 (New-Font 28 $true) $bNeon

# QR (baixa de api.qrserver.com - preto no branco, alta legibilidade)
$qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=https%3A%2F%2Fvcamp0s.github.io%2Fboleta%2F'
$qrTmp = Join-Path $env:TEMP 'boleta-qr.png'
Invoke-WebRequest -Uri $qrUrl -OutFile $qrTmp -TimeoutSec 25
Round 380 596 320 320 18 $bWhite $null
$qr = [System.Drawing.Image]::FromFile($qrTmp)
$g.DrawImage($qr, 400, 616, 280, 280)
$qr.Dispose()
Text-C 'Aponte a câmera para o QR — ou digite o link acima' 936 (New-Font 23 $false) $bDim

# divisor
$penLine = New-Object System.Drawing.Pen($cLine, 1)
$g.DrawLine($penLine, 120, 996, 960, 996)

# Android
Text-L 'NO ANDROID (Chrome)' 120 1018 (New-Font 27 $true) $bNeon
$fStep = New-Font 24 $false
Text-L '1.  Abra o link no Chrome' 120 1068 $fStep $bText
Text-L '2.  Menu (3 pontinhos)  >  Instalar app' 120 1110 $fStep $bText
Text-L '3.  Confirme — pronto!' 120 1152 $fStep $bText

# iPhone
Text-L 'NO iPHONE (Safari)' 120 1224 (New-Font 27 $true) $bNeon
Text-L '1.  Abra o link no Safari' 120 1274 $fStep $bText
Text-L '2.  Compartilhar (quadrado com seta)' 120 1316 $fStep $bText
Text-L '3.  Adicionar à Tela de Início' 120 1358 $fStep $bText

# rodape
$g.DrawLine($penLine, 120, 1418, 960, 1418)
Text-C 'Grátis  •  Protegido por PIN  •  Seus dados ficam só no seu aparelho' 1442 (New-Font 22 $false) $bDim
Text-C 'Erros ou bugs?  WhatsApp (11) 93295-5199' 1498 (New-Font 23 $true) $bNeon

$out = Join-Path $root 'boleta-instalar.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"folheto gerado: $out"
