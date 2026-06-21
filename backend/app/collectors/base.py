"""Shared types for connection sources."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class RawConnection:
    """A single network connection observation from a source."""

    pid: int | None
    process_name: str
    executable_path: str | None
    username: str | None
    local_ip: str
    local_port: int
    remote_ip: str | None
    remote_port: int | None
    protocol: str
    status: str


class ConnectionSource(Protocol):
    """Provides point-in-time snapshots of network connections."""

    name: str

    def poll(self) -> tuple[list[RawConnection], bool]:
        """Return (connections, permission_limited)."""
        ...
