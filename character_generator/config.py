"""Shared, deterministic Astra H-08 build configuration."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = PROJECT_ROOT / "assets" / "character-3d" / "astra-h08"
REFERENCE_SHEET = ASSET_ROOT / "concept" / "astra-h08-character-sheet-v1.png"
OUTPUT_ROOT = ASSET_ROOT / "output"
QA_ROOT = ASSET_ROOT / "qa"

CHARACTER_NAME = "Astra H-08"
TARGET_HEIGHT_METERS = 1.70
FPS = 60

# Project-owned 2D sheet is the only permitted external input.
PROVENANCE = {
    "input_policy": "project-owned-2d-reference-only",
    "external_3d_models": False,
    "generator": "Blender Python mesh.from_pydata/bmesh",
    "reference": str(REFERENCE_SHEET),
}

for folder in (OUTPUT_ROOT, QA_ROOT):
    folder.mkdir(parents=True, exist_ok=True)
