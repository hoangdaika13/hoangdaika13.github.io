"""Gated Blender entry point for Astra H-08 phase 09 animation.

The module never opens a file.  Run it only with the approved character scene
already open; a rejected HUMAN_BASE or absent ASTRA_RIG fails before mutation.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from animation import build_action_library, validate_actions  # noqa: E402
from phase_runner import require_open_approved_body  # noqa: E402


def main() -> dict[str, object]:
    require_open_approved_body()
    result = build_action_library(mutate_scene_timing=True)
    report = validate_actions(raise_on_error=True)
    print(f"[09/15 ANIMATION] {json.dumps(report, ensure_ascii=False)}")
    return result.report() | {"validation": report}


if __name__ == "__main__":
    main()
