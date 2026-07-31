param(
  [Parameter(Mandatory = $true)][string]$RawDirectory,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [int]$Offset = 0,
  [int]$Stride = 1
)

$ErrorActionPreference = "Stop"
$rawRoot = (Resolve-Path -LiteralPath $RawDirectory).Path
$outputRoot = (Resolve-Path -LiteralPath $OutputDirectory).Path
$tool = "C:\Users\Admin\AppData\Roaming\npm\gltf-transform.cmd"
if (-not (Test-Path -LiteralPath $tool)) {
  throw "gltf-transform was not found at $tool"
}

$files = @(Get-ChildItem -LiteralPath $rawRoot -File -Filter "*-raw.glb" | Sort-Object Name)
for ($index = $Offset; $index -lt $files.Count; $index += $Stride) {
  $file = $files[$index]
  $id = $file.BaseName.Substring(0, $file.BaseName.Length - 4)
  $lod0 = Join-Path $outputRoot "$id-lod0.glb"
  $lod1Temp = Join-Path $outputRoot "$id-lod1.uncompressed.glb"
  $lod1 = Join-Path $outputRoot "$id-lod1.glb"
  $lod2Temp = Join-Path $outputRoot "$id-lod2.uncompressed.glb"
  $lod2 = Join-Path $outputRoot "$id-lod2.glb"

  & $tool meshopt $file.FullName $lod0 --level medium *> $null
  if ($LASTEXITCODE -ne 0) { Copy-Item -LiteralPath $file.FullName -Destination $lod0 -Force }

  & $tool simplify $lod0 $lod1Temp --ratio 0.65 --error 0.003 *> $null
  if ($LASTEXITCODE -eq 0) { & $tool meshopt $lod1Temp $lod1 --level medium *> $null }
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $lod1)) {
    Copy-Item -LiteralPath $lod0 -Destination $lod1 -Force
  }

  & $tool simplify $lod0 $lod2Temp --ratio 0.35 --error 0.01 *> $null
  if ($LASTEXITCODE -eq 0) { & $tool meshopt $lod2Temp $lod2 --level medium *> $null }
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $lod2)) {
    Copy-Item -LiteralPath $lod1 -Destination $lod2 -Force
  }
  Write-Output $id
}
