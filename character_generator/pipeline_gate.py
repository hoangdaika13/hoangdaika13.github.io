"""Fail-closed release gate shared by post-body Astra H-08 phases.

The numeric HUMAN_BASE report is useful technical evidence, but it is not an
artist approval.  Phases 03-06 may be imported and unit tested while the body is
under review; geometry construction is allowed only after the manually authored
review record explicitly approves the next phase.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
REPOSITORY_ROOT = ROOT.parent
HUMAN_BASE_BLEND = ROOT / "output" / "HUMAN_BASE.blend"
HUMAN_BASE_REPORT = ROOT / "output" / "HUMAN_BASE.report.json"
HUMAN_BASE_REVIEW = (
    REPOSITORY_ROOT
    / "assets"
    / "character-3d"
    / "astra-h08"
    / "qa"
    / "human-base-latest.review.json"
)


class HumanBaseGateError(RuntimeError):
    """Raised when a post-body phase is invoked before visual approval."""


@dataclass(frozen=True)
class HumanBaseApproval:
    blend_path: Path
    report_path: Path
    review_path: Path
    report: dict[str, Any]
    review: dict[str, Any]


def _load_json(path: Path, label: str) -> dict[str, Any]:
    if not path.is_file():
        raise HumanBaseGateError(f"{label} is missing: {path}")
    try:
        # PowerShell's default UTF-8 writer may include a BOM.  Treat it as an
        # encoding marker rather than making a valid manual review unreadable.
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HumanBaseGateError(f"{label} is unreadable: {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise HumanBaseGateError(f"{label} must contain a JSON object: {path}")
    return payload


def inspect_human_base_gate(
    *,
    blend_path: Path = HUMAN_BASE_BLEND,
    report_path: Path = HUMAN_BASE_REPORT,
    review_path: Path = HUMAN_BASE_REVIEW,
) -> HumanBaseApproval:
    """Read and validate all immutable technical prerequisites.

    This function deliberately does not treat passing topology checks as visual
    approval.  It is safe to call from tests because it never opens Blender or
    mutates a scene.
    """
    blend_path = Path(blend_path)
    report_path = Path(report_path)
    review_path = Path(review_path)
    if not blend_path.is_file():
        raise HumanBaseGateError(f"HUMAN_BASE blend is missing: {blend_path}")

    report = _load_json(report_path, "HUMAN_BASE technical report")
    review = _load_json(review_path, "HUMAN_BASE visual review")

    technical_failures: list[str] = []
    if report.get("continuous_body") is not True:
        technical_failures.append("continuous_body must be true")
    if report.get("external_model_used") is not False:
        technical_failures.append("external_model_used must be false")
    if report.get("connected_components") != 1:
        technical_failures.append("connected_components must equal 1")
    if report.get("non_manifold_edges") != 0:
        technical_failures.append("non_manifold_edges must equal 0")
    if technical_failures:
        raise HumanBaseGateError(
            "HUMAN_BASE technical gate failed: " + "; ".join(technical_failures)
        )

    return HumanBaseApproval(blend_path, report_path, review_path, report, review)


def require_human_base_approved(**paths: Path) -> HumanBaseApproval:
    """Require an explicit, current manual decision before building phases 03-06."""
    approval = inspect_human_base_gate(**paths)
    review = approval.review
    approved = review.get("approvedForNextPhase") is True
    status = str(review.get("status", "")).strip().lower()
    if not approved or status not in {"approved", "approved-for-next-phase"}:
        release_gate = str(review.get("releaseGate", "Manual visual approval is required."))
        raise HumanBaseGateError(
            "HUMAN_BASE has not passed the manual visual gate "
            f"(status={status or 'missing'}, approvedForNextPhase={review.get('approvedForNextPhase')!r}). "
            f"{release_gate}"
        )
    return approval
