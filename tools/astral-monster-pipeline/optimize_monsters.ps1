param(
  [Parameter(Mandatory = $true)][string]$InputDirectory,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [int]$Offset = 0,
  [int]$Stride = 1
)

$ErrorActionPreference = "Stop"
$inputRoot = (Resolve-Path -LiteralPath $InputDirectory).Path
$outputRoot = (Resolve-Path -LiteralPath $OutputDirectory).Path
$tool = "C:\Users\Admin\AppData\Roaming\npm\gltf-transform.cmd"
if (-not (Test-Path -LiteralPath $tool)) { throw "gltf-transform was not found" }

$files = @(Get-ChildItem -LiteralPath $inputRoot -File -Filter "*.gltf" | Sort-Object Name)
for ($index = $Offset; $index -lt $files.Count; $index += $Stride) {
  $source = $files[$index]
  $output = Join-Path $outputRoot "$($source.BaseName).glb"
  & $tool meshopt $source.FullName $output --level medium *> $null
  if ($LASTEXITCODE -ne 0) { throw "Could not optimize $($source.Name)" }
  Write-Output $source.BaseName
}
