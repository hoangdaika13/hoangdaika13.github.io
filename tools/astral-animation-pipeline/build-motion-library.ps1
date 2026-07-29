param(
  [string]$Blender = "C:\Users\Admin\Documents\HTML\.tools\blender-5.2.0\blender-5.2.0-windows-x64\blender.exe",
  [string]$Target = "assets\astral-realms\characters\default\valid-asian-f-1-casual.glb",
  [string[]]$Source = @("assets\astral-realms\hh-human-vanguard-v1.glb")
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$blenderPath = (Resolve-Path -LiteralPath $Blender).Path
$targetPath = (Resolve-Path -LiteralPath (Join-Path $repo $Target)).Path
$scriptPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "bake_motion_library.py")).Path
$planPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "motion-plan.json")).Path
$channelValidator = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "validate-motion-channels.mjs")).Path
$assetDir = Join-Path $repo "assets\astral-realms\animations"
$rawOutput = Join-Path $assetDir "hh-human-motion-v13.raw.glb"
$output = Join-Path $assetDir "hh-human-motion-v13.glb"
$manifest = Join-Path $assetDir "motion-library-v13.json"

New-Item -ItemType Directory -Path $assetDir -Force | Out-Null
$sourceItems = @($Source)
$workspace = Split-Path -Parent $repo
$freePack = Join-Path $workspace ".tools\quaternius-universal-animation-standard\Animation Library[Standard]\Godot\AnimationLibrary_Godot_Standard.glb"
if (Test-Path -LiteralPath $freePack) {
  $sourceItems += $freePack
}
$sourceArgs = @()
foreach ($item in ($sourceItems | Select-Object -Unique)) {
  $candidate = if ([System.IO.Path]::IsPathRooted($item)) { $item } else { Join-Path $repo $item }
  $sourcePath = (Resolve-Path -LiteralPath $candidate).Path
  $sourceArgs += @("--source", $sourcePath)
}

& $blenderPath --background --factory-startup --python $scriptPath -- `
  --target $targetPath @sourceArgs --output $rawOutput --manifest $manifest --plan $planPath --fps 30
if ($LASTEXITCODE -ne 0) { throw "Blender bake thất bại: $LASTEXITCODE" }

& gltf-transform.cmd resample $rawOutput $rawOutput
if ($LASTEXITCODE -ne 0) { throw "Animation resample thất bại: $LASTEXITCODE" }
& node $channelValidator $rawOutput $manifest
if ($LASTEXITCODE -ne 0) { throw "Raw motion channel/value validation failed: $LASTEXITCODE" }
& gltf-transform.cmd meshopt $rawOutput $output --level medium
if ($LASTEXITCODE -ne 0) { throw "Meshopt thất bại: $LASTEXITCODE" }
& node $channelValidator $output $manifest
if ($LASTEXITCODE -ne 0) { throw "Motion channel validation thất bại: $LASTEXITCODE" }

$payload = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
$payload.asset = [System.IO.Path]::GetFileName($output)
$payload | Add-Member -NotePropertyName optimized -NotePropertyValue "resample+meshopt" -Force
[System.IO.File]::WriteAllText($manifest, ($payload | ConvertTo-Json -Depth 12) + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Remove-Item -LiteralPath $rawOutput -Force
& gltf-transform.cmd inspect $output --format md
Write-Host "Motion library: $output"
Write-Host "Manifest: $manifest"
