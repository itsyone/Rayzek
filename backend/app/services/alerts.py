"""Explainable, rule-based alert engine.

All alerts carry machine-readable evidence and use neutral language. Nothing
here claims that an application is malware or blocks any connection.
"""

from __future__ import annotations

import json
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field

from app.core.logging_config import get_logger
from app.models import Alert
from app.utils.netutils import is_uncommon_port

logger = get_logger("rayzek.alerts")


@dataclass
class AlertDraft:
    alert_type: str
    severity: str
    title: str
    description: str
    process_name: str | None
    remote_ip: str | None
    destination_country: str | None
    evidence: dict


@dataclass
class _ProcessWindow:
    """Sliding 60-second window of activity for a single process."""

    opens: deque[float] = field(default_factory=deque)
    failures: deque[float] = field(default_factory=deque)
    countries: set[str] = field(default_factory=set)
    seen_ips: set[str] = field(default_factory=set)
    seen_countries: set[str] = field(default_factory=set)

    def prune(self, now: float, window: float = 60.0) -> None:
        while self.opens and now - self.opens[0] > window:
            self.opens.popleft()
        while self.failures and now - self.failures[0] > window:
            self.failures.popleft()


class AlertEngine:
    """Stateful detector. Thresholds are configurable via update_thresholds()."""

    DEFAULTS = {
        "burst_threshold": 100,
        "burst_window_seconds": 60,
        "many_countries_threshold": 6,
        "failure_threshold": 15,
        "enable_new_country": True,
        # Off by default: every site visited is a "new destination" the first
        # time, so this is informational noise unless explicitly enabled.
        "enable_new_destination": False,
        "enable_connection_burst": True,
        "enable_many_countries": True,
        "enable_uncommon_port": True,
        "enable_repeated_failures": True,
        # Off by default: produces noise on systems where some executables can't
        # be resolved (background/system processes).
        "enable_unknown_executable": False,
    }

    # The monitoring app must never raise alerts about itself, and a few noisy
    # OS/background processes are excluded to keep the feed signal-rich.
    IGNORED_PROCESS_NAMES: frozenset[str] = frozenset(
        {"rayzek.exe", "rayzek", "svchost.exe", "system", "system idle process"}
    )

    def __init__(self, thresholds: dict | None = None) -> None:
        self._cfg = dict(self.DEFAULTS)
        if thresholds:
            self._cfg.update(thresholds)
        self._windows: dict[str, _ProcessWindow] = defaultdict(_ProcessWindow)
        # Dedupe identical alerts within a cooldown to avoid spam.
        self._recent: dict[str, float] = {}
        # Long cooldown: the same finding should not re-fire for ~10 minutes.
        self._cooldown = 600.0

    def update_thresholds(self, thresholds: dict) -> None:
        self._cfg.update({k: v for k, v in thresholds.items() if k in self._cfg})

    def _should_emit(self, dedupe_key: str, now: float) -> bool:
        last = self._recent.get(dedupe_key, 0.0)
        if now - last < self._cooldown:
            return False
        self._recent[dedupe_key] = now
        return True

    def evaluate(
        self,
        *,
        process_name: str,
        executable_path: str | None,
        remote_ip: str | None,
        remote_port: int | None,
        country_code: str | None,
        country_name: str | None,
        status: str,
        is_new_connection: bool,
    ) -> list[AlertDraft]:
        """Evaluate all enabled rules for one observation. Returns drafts."""
        # Never alert on the monitoring app itself or excluded noisy processes.
        if (process_name or "").lower() in self.IGNORED_PROCESS_NAMES:
            return []

        now = time.monotonic()
        drafts: list[AlertDraft] = []
        win = self._windows[process_name]
        win.prune(now)

        if is_new_connection:
            win.opens.append(now)
        if status in {"SYN_SENT", "CLOSE_WAIT", "FIN_WAIT1", "FIN_WAIT2", "TIME_WAIT"}:
            win.failures.append(now)

        # Rule 1: new country
        if (
            self._cfg["enable_new_country"]
            and country_code
            and country_code not in win.seen_countries
        ):
            win.seen_countries.add(country_code)
            if len(win.seen_countries) > 1 and self._should_emit(
                f"newcountry:{process_name}:{country_code}", now
            ):
                drafts.append(
                    AlertDraft(
                        alert_type="new_country",
                        severity="low",
                        title=f"{process_name} contacted a new country",
                        description=(
                            f"{process_name} connected to {country_name or country_code} "
                            "for the first time. Review recommended."
                        ),
                        process_name=process_name,
                        remote_ip=remote_ip,
                        destination_country=country_name,
                        evidence={
                            "rule": "new_country",
                            "process": process_name,
                            "country_code": country_code,
                        },
                    )
                )

        # Rule 2: new destination
        if (
            self._cfg["enable_new_destination"]
            and is_new_connection
            and remote_ip
            and remote_ip not in win.seen_ips
        ):
            win.seen_ips.add(remote_ip)
            if self._should_emit(f"newdest:{process_name}:{remote_ip}", now):
                drafts.append(
                    AlertDraft(
                        alert_type="new_destination",
                        severity="informational",
                        title=f"New destination observed for {process_name}",
                        description=(
                            f"{process_name} contacted {remote_ip} for the first time."
                        ),
                        process_name=process_name,
                        remote_ip=remote_ip,
                        destination_country=country_name,
                        evidence={
                            "rule": "new_destination",
                            "process": process_name,
                            "remote_ip": remote_ip,
                        },
                    )
                )

        # Rule 3: connection burst
        if self._cfg["enable_connection_burst"]:
            count = len(win.opens)
            if count >= self._cfg["burst_threshold"] and self._should_emit(
                f"burst:{process_name}", now
            ):
                drafts.append(
                    AlertDraft(
                        alert_type="connection_burst",
                        severity="medium",
                        title=f"High connection volume from {process_name}",
                        description=(
                            f"{process_name} opened {count} connections in the last "
                            f"{self._cfg['burst_window_seconds']}s. Review recommended."
                        ),
                        process_name=process_name,
                        remote_ip=remote_ip,
                        destination_country=country_name,
                        evidence={
                            "rule": "connection_burst",
                            "process": process_name,
                            "connections_in_60_seconds": count,
                            "threshold": self._cfg["burst_threshold"],
                        },
                    )
                )

        # Rule 4: many destination countries
        if self._cfg["enable_many_countries"]:
            if len(win.seen_countries) >= self._cfg["many_countries_threshold"] and (
                self._should_emit(f"manycountries:{process_name}", now)
            ):
                drafts.append(
                    AlertDraft(
                        alert_type="many_countries",
                        severity="medium",
                        title=f"{process_name} contacted many countries",
                        description=(
                            f"{process_name} has contacted {len(win.seen_countries)} "
                            "different countries. Review recommended."
                        ),
                        process_name=process_name,
                        remote_ip=remote_ip,
                        destination_country=country_name,
                        evidence={
                            "rule": "many_countries",
                            "process": process_name,
                            "country_count": len(win.seen_countries),
                            "threshold": self._cfg["many_countries_threshold"],
                        },
                    )
                )

        # Rule 5: uncommon remote port
        if (
            self._cfg["enable_uncommon_port"]
            and is_new_connection
            and is_uncommon_port(remote_port)
        ):
            if self._should_emit(f"port:{process_name}:{remote_port}", now):
                drafts.append(
                    AlertDraft(
                        alert_type="uncommon_port",
                        severity="low",
                        title=f"{process_name} used an uncommon port",
                        description=(
                            f"{process_name} connected to {remote_ip}:{remote_port}, "
                            "an uncommon external port. Review recommended."
                        ),
                        process_name=process_name,
                        remote_ip=remote_ip,
                        destination_country=country_name,
                        evidence={
                            "rule": "uncommon_port",
                            "process": process_name,
                            "remote_port": remote_port,
                        },
                    )
                )

        # Rule 6: rapid repeated failures
        if self._cfg["enable_repeated_failures"]:
            fails = len(win.failures)
            if fails >= self._cfg["failure_threshold"] and self._should_emit(
                f"failures:{process_name}", now
            ):
                drafts.append(
                    AlertDraft(
                        alert_type="repeated_failures",
                        severity="low",
                        title=f"Repeated connection failures from {process_name}",
                        description=(
                            f"{process_name} produced {fails} failing/closing "
                            "connections recently. Review recommended."
                        ),
                        process_name=process_name,
                        remote_ip=remote_ip,
                        destination_country=country_name,
                        evidence={
                            "rule": "repeated_failures",
                            "process": process_name,
                            "failures_in_60_seconds": fails,
                            "threshold": self._cfg["failure_threshold"],
                        },
                    )
                )

        # Rule 7: unknown / temporary-looking executable
        if self._cfg["enable_unknown_executable"] and is_new_connection:
            looks_temp = _looks_temporary(process_name, executable_path)
            if looks_temp and self._should_emit(f"unknownexe:{process_name}", now):
                drafts.append(
                    AlertDraft(
                        alert_type="unknown_executable",
                        severity="low",
                        title=f"Unresolved executable for {process_name}",
                        description=(
                            f"The executable for {process_name} could not be resolved "
                            "or looks temporary. Review recommended."
                        ),
                        process_name=process_name,
                        remote_ip=remote_ip,
                        destination_country=country_name,
                        evidence={
                            "rule": "unknown_executable",
                            "process": process_name,
                            "executable_path": executable_path,
                        },
                    )
                )

        return drafts


def _looks_temporary(name: str, path: str | None) -> bool:
    lowered_name = (name or "").lower()
    if not path:
        return True
    lowered_path = path.lower()
    suspicious_dirs = ("\\temp\\", "/tmp/", "\\appdata\\local\\temp", "\\downloads\\")
    if any(part in lowered_path for part in suspicious_dirs):
        return True
    if lowered_name in {"", "unknown", "unknown.exe"}:
        return True
    return False


def draft_to_model(draft: AlertDraft) -> Alert:
    return Alert(
        alert_type=draft.alert_type,
        severity=draft.severity,
        title=draft.title,
        description=draft.description,
        process_name=draft.process_name,
        remote_ip=draft.remote_ip,
        destination_country=draft.destination_country,
        evidence=json.dumps(draft.evidence),
    )
