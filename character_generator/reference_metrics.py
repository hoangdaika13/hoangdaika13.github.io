"""Reference-space metrics and fail-closed comparison helpers for Astra H-08.

The 2D sheets remain the design authority.  These helpers describe measurable
silhouette ratios and required evidence without pretending that pixel similarity
alone proves a successful 3D character.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
SPEC_PATH = ROOT / "reference_spec.json"


@dataclass(frozen=True)
class SilhouetteTargets:
    shoulder_to_height: tuple[float, float] = (0.23, 0.27)
    waist_to_shoulder: tuple[float, float] = (0.62, 0.73)
    hip_to_shoulder: tuple[float, float] = (0.88, 1.02)
    foot_to_height: tuple[float, float] = (0.145, 0.175)
    head_units: tuple[float, float] = (7.5, 8.0)


TARGETS = SilhouetteTargets()


def load_reference_spec(path: Path = SPEC_PATH) -> dict[str, Any]:
    value = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict) or value.get("character") != "Astra H-08":
        raise ValueError("Invalid Astra H-08 reference specification")
    return value


def _in_range(value: float, bounds: tuple[float, float]) -> bool:
    return bounds[0] <= float(value) <= bounds[1]


def evaluate_body_report(report: dict[str, Any]) -> dict[str, Any]:
    height = float(report.get("height_m") or 0.0)
    shoulder = float(report.get("shoulder_width_m") or 0.0)
    waist_ratio = float(report.get("waist_to_shoulder") or 0.0)
    hip_ratio = float(report.get("hip_to_shoulder") or 0.0)
    foot = float(report.get("foot_length_m") or 0.0)
    head_units = float(report.get("head_units") or 0.0)
    ratios = {
        "shoulderToHeight": shoulder / height if height else 0.0,
        "waistToShoulder": waist_ratio,
        "hipToShoulder": hip_ratio,
        "footToHeight": foot / height if height else 0.0,
        "headUnits": head_units,
    }
    checks = {
        "continuousBody": report.get("continuous_body") is True,
        "singleComponent": report.get("connected_components") == 1,
        "manifold": report.get("non_manifold_edges") == 0,
        "externalModelFree": report.get("external_model_used") is False,
        "shoulderRatio": _in_range(ratios["shoulderToHeight"], TARGETS.shoulder_to_height),
        "waistRatio": _in_range(ratios["waistToShoulder"], TARGETS.waist_to_shoulder),
        "hipRatio": _in_range(ratios["hipToShoulder"], TARGETS.hip_to_shoulder),
        "footRatio": _in_range(ratios["footToHeight"], TARGETS.foot_to_height),
        "headUnits": _in_range(ratios["headUnits"], TARGETS.head_units),
    }
    return {
        "passedTechnicalAndProportionChecks": all(checks.values()),
        "checks": checks,
        "ratios": {name: round(value, 4) for name, value in ratios.items()},
        "visualApprovalStillRequired": True,
    }


if __name__ == "__main__":
    report_path = ROOT / "output" / "HUMAN_BASE.report.json"
    report = json.loads(report_path.read_text(encoding="utf-8-sig"))
    print(json.dumps(evaluate_body_report(report), ensure_ascii=False, indent=2))
