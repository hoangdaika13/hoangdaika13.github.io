"""Gated phase-five hard-surface armor entry point.

The implementation lives in :mod:`modeling.armor`; this wrapper deliberately
checks the manual HUMAN_BASE review before opening or mutating any scene data.
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy


PROJECT_DIR = Path(__file__).resolve().parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from modeling.armor import build_armor  # noqa: E402
from phase_runner import phase_summary, require_open_approved_body  # noqa: E402


def main() -> None:
    body = require_open_approved_body()
    phase_summary("05/15 ARMOR", build_armor(body))


if __name__ == "__main__":
    main()
