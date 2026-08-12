"""Gated Blender entry point for Astra H-08 phase 06."""

from __future__ import annotations

import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from materials.materials import assign_character_materials, build_materials  # noqa: E402
from phase_runner import require_open_approved_body  # noqa: E402


def main() -> None:
    require_open_approved_body()
    assign_character_materials(build_materials())


if __name__ == "__main__":
    main()
