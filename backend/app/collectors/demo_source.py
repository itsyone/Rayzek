"""Synthetic connection source for demo mode.

Generates realistic-looking connections without reading the user's real
network state. Useful for safe frontend development and screenshots.
"""

from __future__ import annotations

import random

from app.collectors.base import ConnectionSource, RawConnection

# (process_name, exe path, typical remote endpoints)
_PROCESSES = [
    ("chrome.exe", "C:\\Program Files\\Google\\Chrome\\chrome.exe"),
    ("discord.exe", "C:\\Users\\demo\\AppData\\Local\\Discord\\discord.exe"),
    ("spotify.exe", "C:\\Users\\demo\\AppData\\Roaming\\Spotify\\spotify.exe"),
    ("steam.exe", "C:\\Program Files (x86)\\Steam\\steam.exe"),
    ("code.exe", "C:\\Users\\demo\\AppData\\Local\\Programs\\VS Code\\code.exe"),
    ("unknown.exe", None),  # occasionally triggers unknown-executable rule
]

# remote_ip, hostname-ish, country handled by enrichment / provider later.
_REMOTES = [
    ("142.250.181.14", 443, "US"),
    ("35.186.224.25", 443, "US"),
    ("162.159.135.232", 443, "US"),
    ("104.16.85.20", 443, "US"),
    ("13.107.42.14", 443, "NL"),
    ("99.86.245.10", 443, "DE"),
    ("151.101.1.140", 443, "GB"),
    ("203.0.113.40", 8443, "JP"),
    ("198.51.100.7", 51820, "SG"),
    ("185.199.108.153", 443, "FR"),
]

_STATUSES = ["ESTABLISHED", "ESTABLISHED", "ESTABLISHED", "SYN_SENT", "CLOSE_WAIT"]


class DemoConnectionSource(ConnectionSource):
    name = "demo"

    def __init__(self, seed: int | None = None) -> None:
        self._rng = random.Random(seed)
        self._pids: dict[str, int] = {
            name: self._rng.randint(1000, 60000) for name, _ in _PROCESSES
        }
        # A stable pool of "active" connections that evolves over time.
        self._active: list[RawConnection] = []
        self._bootstrap()

    def _make(self) -> RawConnection:
        name, exe = self._rng.choice(_PROCESSES)
        remote_ip, remote_port, _country = self._rng.choice(_REMOTES)
        return RawConnection(
            pid=self._pids[name],
            process_name=name,
            executable_path=exe,
            username="demo",
            local_ip="192.168.1.42",
            local_port=self._rng.randint(49152, 65535),
            remote_ip=remote_ip,
            remote_port=remote_port,
            protocol="TCP",
            status=self._rng.choice(_STATUSES),
        )

    def _bootstrap(self) -> None:
        for _ in range(self._rng.randint(8, 16)):
            self._active.append(self._make())

    def poll(self) -> tuple[list[RawConnection], bool]:
        # Churn: drop a few, add a few, keep the bulk stable.
        if self._active and self._rng.random() < 0.4:
            for _ in range(self._rng.randint(1, 2)):
                if self._active:
                    self._active.pop(self._rng.randrange(len(self._active)))
        if self._rng.random() < 0.6:
            for _ in range(self._rng.randint(1, 3)):
                self._active.append(self._make())

        # Occasional burst to trigger volume alerts.
        if self._rng.random() < 0.04:
            burst_name, burst_exe = _PROCESSES[-1]  # unknown.exe
            for _ in range(40):
                self._active.append(
                    RawConnection(
                        pid=self._pids[burst_name],
                        process_name=burst_name,
                        executable_path=burst_exe,
                        username="demo",
                        local_ip="192.168.1.42",
                        local_port=self._rng.randint(49152, 65535),
                        remote_ip=self._rng.choice(_REMOTES)[0],
                        remote_port=self._rng.choice(_REMOTES)[1],
                        protocol="TCP",
                        status="SYN_SENT",
                    )
                )

        # Cap the working set.
        if len(self._active) > 220:
            self._active = self._active[-180:]

        return (list(self._active), False)
