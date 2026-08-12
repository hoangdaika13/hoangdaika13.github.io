"""Ordinary-Python source validation for the Astra rigging package."""

from __future__ import annotations

import ast
import json
from pathlib import Path


PACKAGE_DIR = Path(__file__).resolve().parent
REQUIRED_SOURCE_TOKENS = {
    "armature.py": (
        "build_humanoid_rig",
        "validate_humanoid_rig",
        'f"hand_ik_{side}"',
        'f"elbow_pole_{side}"',
        'f"foot_ik_{side}"',
        'f"knee_pole_{side}"',
        'f"{finger}_{segment}_{{side}}"',
    ),
    "facial_rig.py": (
        "Blink_L",
        "Blink_R",
        "Blink_Both",
        "Smile",
        "Angry",
        "Sad",
        "Surprised",
        "Mouth_A",
        "Mouth_E",
        "Mouth_I",
        "Mouth_O",
        "Mouth_U",
    ),
    "hair_rig.py": (
        "hair_front_01",
        "hair_side_L_01",
        "hair_side_R_01",
        "hair_back_01",
        "braid_01",
        "braid_05",
    ),
}


def validate_sources() -> dict[str, object]:
    issues: list[str] = []
    parsed: list[str] = []
    for path in sorted(PACKAGE_DIR.glob("*.py")):
        source = path.read_text(encoding="utf-8")
        try:
            tree = ast.parse(source, filename=str(path))
        except SyntaxError as exc:
            issues.append(f"{path.name}: {exc}")
            continue
        parsed.append(path.name)
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                modules = [alias.name for alias in node.names] if isinstance(node, ast.Import) else [node.module or ""]
                forbidden_roots = ("re" + "quests", "url" + "lib", "http" + "x")
                if any(name.startswith(forbidden_roots) for name in modules):
                    issues.append(f"{path.name}:{node.lineno}: network dependency")
        for token in REQUIRED_SOURCE_TOKENS.get(path.name, ()):
            if token not in source:
                issues.append(f"{path.name}: missing contract token {token}")
    return {
        "ok": not issues,
        "files": parsed,
        "expected_humanoid_core_bones": 86,
        "expected_finger_phalanges": 30,
        "expected_hair_bones": 17,
        "expected_facial_shape_keys": 28,
        "issues": issues,
    }


if __name__ == "__main__":
    report = validate_sources()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["ok"] else 1)


__all__ = ("validate_sources",)
