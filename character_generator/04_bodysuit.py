"""Gated Blender entry point for Astra H-08 phase 04."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from modeling.bodysuit import build_bodysuit  # noqa: E402
from phase_runner import phase_summary, require_open_approved_body  # noqa: E402


def main() -> None:
    body = require_open_approved_body()
    phase_summary("04/15 BODYSUIT", build_bodysuit(body))


if __name__ == "__main__":
    main()
