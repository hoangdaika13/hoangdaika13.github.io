"""Executable Blender entry point for Phase 1 HUMAN_BASE generation.

Run:
  blender --background --python character_generator/01_body_generator.py
"""

from __future__ import annotations

import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from main_body import main  # noqa: E402


if __name__ == "__main__":
    main()
