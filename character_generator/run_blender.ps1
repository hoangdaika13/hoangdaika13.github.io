param(
    [ValidateSet("body", "rig", "animation", "full", "export")]
    [string]$Phase = "body"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$blender = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"

if (-not (Test-Path -LiteralPath $blender)) {
    throw "Blender 5.2 was not found at $blender"
}

$script = switch ($Phase) {
    "body" { Join-Path $PSScriptRoot "01_body_generator.py" }
    "rig" { Join-Path $PSScriptRoot "07_rig.py" }
    "animation" { Join-Path $PSScriptRoot "09_animation.py" }
    "full" { Join-Path $PSScriptRoot "main.py" }
    "export" { Join-Path $PSScriptRoot "export_release.py" }
}

if ($Phase -in @("rig", "animation")) {
    throw "Phase '$Phase' requires the already-open approved character scene. Import the entry point from Blender's Text Editor; this launcher intentionally refuses a factory-startup scene."
}

if (-not (Test-Path -LiteralPath $script)) {
    throw "Build phase script is not ready: $script"
}

Push-Location $repoRoot
try {
    & $blender --background --python $script
    if ($LASTEXITCODE -ne 0) {
        throw "Blender build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
