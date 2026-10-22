# Rebuilds the PNG copies measure.mjs reads from the committed Commons JPGs (System.Drawing; no other tools needed):
# powershell -NoProfile -File refs/water/river-audit/reference/to-png.ps1
Add-Type -AssemblyName System.Drawing
Get-ChildItem (Join-Path $PSScriptRoot 'real-*.jpg') | ForEach-Object { $b = [System.Drawing.Image]::FromFile($_.FullName); $b.Save([IO.Path]::ChangeExtension($_.FullName, '.png'), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose() }
