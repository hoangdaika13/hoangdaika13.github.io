"""Static source and manifest validation for the Astra animation package.

Run with ordinary Python; Blender is not imported and no scene is opened.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path

try:
    from .manifest import ACTION_NAMES, FPS, validate_manifest
except ImportError:  # Direct ``python static_validate.py`` execution.
    from manifest import ACTION_NAMES, FPS, validate_manifest


PACKAGE_DIR = Path(__file__).resolve().parent
FORBIDDEN_AST_CALLS = {
    ".".join(parts)
    for parts in (
        ("bpy", "ops", "import_scene", "fbx"),
        ("bpy", "ops", "import_scene", "obj"),
        ("bpy", "ops", "import_scene", "gltf"),
        ("bpy", "ops", "wm", "open_mainfile"),
        ("bpy", "ops", "wm", "append"),
        ("bpy", "ops", "wm", "link"),
    )
}


def _dotted_name(node: ast.AST) -> str | None:
    parts: list[str] = []
    current = node
    while isinstance(current, ast.Attribute):
        parts.append(current.attr)
        current = current.value
    if isinstance(current, ast.Name):
        parts.append(current.id)
        return ".".join(reversed(parts))
    return None


def validate_sources() -> dict[str, object]:
    issues: list[str] = []
    files = sorted(PACKAGE_DIR.glob("*.py"))
    forbidden_hits: list[str] = []
    import_time_calls: list[str] = []
    for path in files:
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except (OSError, SyntaxError) as exc:
            issues.append(f"{path.name}: {exc}")
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                dotted = _dotted_name(node.func)
                if dotted in FORBIDDEN_AST_CALLS:
                    forbidden_hits.append(f"{path.name}:{node.lineno}:{dotted}")
        for statement in tree.body:
            # Function/class decorators and the manifest's pure self-check are
            # allowed.  Direct Blender builder calls at module scope are not.
            if isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Call):
                dotted = _dotted_name(statement.value.func) or "<dynamic-call>"
                if dotted not in {"validate_manifest"}:
                    import_time_calls.append(f"{path.name}:{statement.lineno}:{dotted}")
    manifest = validate_manifest()
    if not manifest["ok"]:
        issues.extend(manifest["issues"])
    if forbidden_hits:
        issues.append("Forbidden external import/open calls found")
    if import_time_calls:
        issues.append("Top-level executable calls found")
    return {
        "ok": not issues,
        "fps": FPS,
        "action_count": len(ACTION_NAMES),
        "actions": list(ACTION_NAMES),
        "files": [path.name for path in files],
        "forbidden_calls": forbidden_hits,
        "import_time_calls": import_time_calls,
        "issues": issues,
    }


if __name__ == "__main__":
    result = validate_sources()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["ok"] else 1)


__all__ = ("validate_sources",)
