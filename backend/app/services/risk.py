"""Conservative risk scoring (0-100) and level mapping."""

from __future__ import annotations

from dataclasses import dataclass

from app.utils.netutils import is_uncommon_port


@dataclass
class RiskInputs:
    is_new_destination: bool = False
    is_new_country: bool = False
    uncommon_port: bool = False
    failed_state: bool = False
    unknown_executable: bool = False
    high_volume: bool = False
    private_destination: bool = False


def compute_risk(inputs: RiskInputs) -> int:
    """Return a conservative 0-100 risk score.

    Weights are intentionally low so that ordinary browsing does not produce
    alarming numbers. Private/local destinations are always low risk.
    """
    if inputs.private_destination:
        return 0

    score = 0
    if inputs.is_new_destination:
        score += 12
    if inputs.is_new_country:
        score += 18
    if inputs.uncommon_port:
        score += 15
    if inputs.failed_state:
        score += 10
    if inputs.unknown_executable:
        score += 20
    if inputs.high_volume:
        score += 20

    return max(0, min(100, score))


def risk_level(score: int) -> str:
    if score >= 75:
        return "high"
    if score >= 50:
        return "elevated"
    if score >= 25:
        return "review"
    return "low"


def quick_score(remote_port: int | None, is_private: bool, status: str) -> int:
    """Lightweight score for a freshly observed connection (no history yet)."""
    return compute_risk(
        RiskInputs(
            uncommon_port=is_uncommon_port(remote_port),
            failed_state=status in {"SYN_SENT", "CLOSE_WAIT", "FIN_WAIT1", "FIN_WAIT2"},
            private_destination=is_private,
        )
    )
