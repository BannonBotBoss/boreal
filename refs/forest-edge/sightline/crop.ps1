# T-0032 (claude): crop the gate box out of a frame, scaled to half size like box-map.png (2 px grid). Args: in out x0 y0 x1 y1
param($in, $out, [int]$x0 = 300, [int]$y0 = 150, [int]$x1 = 900, [int]$y1 = 230)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $in)); $w = ($x1 - $x0) / 2; $h = ($y1 - $y0) / 2
$dst = New-Object System.Drawing.Bitmap $w, $h; $g = [System.Drawing.Graphics]::FromImage($dst)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $x0, $y0, ($x1 - $x0), ($y1 - $y0)), [System.Drawing.GraphicsUnit]::Pixel)
$dst.Save($out); $g.Dispose(); $dst.Dispose(); $src.Dispose()
