param(
  [string]$Destination = "C:\Users\Admin\Documents\HTML\.tools\quaternius-universal-animation-standard"
)

$ErrorActionPreference = "Stop"
$url = "https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip"
$expectedSha256 = "18FF1A7215F4852B320203E8AAF02A1578B5C8EEF9027FBAEDFCEDC7B85A3AC2"
$toolsRoot = Split-Path -Parent $Destination
$archive = Join-Path $toolsRoot "universal_animation_librarystandard.zip"
$asset = Join-Path $Destination "Animation Library[Standard]\Godot\AnimationLibrary_Godot_Standard.glb"

New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $archive)) {
  Invoke-WebRequest -Uri $url -OutFile $archive
}
$actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash
if ($actualSha256 -ne $expectedSha256) {
  throw "Quaternius archive SHA-256 mismatch. Expected $expectedSha256, received $actualSha256."
}
if (-not (Test-Path -LiteralPath $asset)) {
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  Expand-Archive -LiteralPath $archive -DestinationPath $Destination -Force
}
if (-not (Test-Path -LiteralPath $asset)) {
  throw "Quaternius GLB was not found after extraction: $asset"
}

Write-Host "Installed CC0 motion pack: $asset"
Write-Host "License: CC0-1.0 (License.txt is bundled beside the asset)"
