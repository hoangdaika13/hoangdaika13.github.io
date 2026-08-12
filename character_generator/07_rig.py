"""Gated Blender entry point for humanoid, facial, and hair rig phases.

This wrapper never opens or saves a file and cannot bypass the HUMAN_BASE gate.
It only operates on objects that already exist in the open approved scene.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from phase_runner import require_open_approved_body  # noqa: E402
from rigging import (  # noqa: E402
    build_facial_rig,
    build_hair_rig,
    build_humanoid_rig,
    validate_facial_shape_keys,
    validate_hair_rig,
    validate_humanoid_rig,
)


def main() -> dict[str, object]:
    require_open_approved_body()
    rig = build_humanoid_rig(require_approval=True)
    hair = build_hair_rig(rig)
    facial = build_facial_rig(rig=rig)
    report = {
        "humanoid": validate_humanoid_rig(rig),
        "hair": validate_hair_rig(rig),
        "facial": validate_facial_shape_keys(facial["object"]),
        "hair_bound_objects": list(hair.bound_objects),
    }
    print(f"[07-08/15 RIG] {json.dumps(report, ensure_ascii=False)}")
    return report


if __name__ == "__main__":
    main()
