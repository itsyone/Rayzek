"""psutil-backed connection source for the local machine only.

Every per-process lookup is wrapped defensively: processes can disappear
between obtaining the PID and reading their attributes, and many attributes
require elevated privileges. We never crash on these conditions.
"""

from __future__ import annotations

import socket

import psutil

from app.collectors.base import ConnectionSource, RawConnection
from app.core.logging_config import get_logger

logger = get_logger("rayzek.collector.system")

_STATUS_NONE = "NONE"


class SystemConnectionSource(ConnectionSource):
    name = "psutil"

    def __init__(self) -> None:
        # Small cache so we do not re-resolve process metadata every tick.
        self._proc_cache: dict[int, tuple[str, str | None, str | None]] = {}
        self._permission_limited = False

    def _process_info(self, pid: int | None) -> tuple[str, str | None, str | None]:
        """Return (name, exe_path, username). Degrades gracefully."""
        if pid is None or pid <= 0:
            return ("unknown", None, None)
        if pid in self._proc_cache:
            return self._proc_cache[pid]

        name = f"pid-{pid}"
        exe: str | None = None
        user: str | None = None
        try:
            proc = psutil.Process(pid)
            with proc.oneshot():
                try:
                    name = proc.name() or name
                except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess):
                    pass
                try:
                    exe = proc.exe() or None
                except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess,
                        PermissionError, OSError):
                    self._permission_limited = True
                try:
                    user = proc.username() or None
                except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess,
                        PermissionError, OSError):
                    self._permission_limited = True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess,
                PermissionError, OSError):
            self._permission_limited = True

        info = (name, exe, user)
        self._proc_cache[pid] = info
        return info

    @staticmethod
    def _protocol(stype: int) -> str:
        if stype == socket.SOCK_STREAM:
            return "TCP"
        if stype == socket.SOCK_DGRAM:
            return "UDP"
        return "OTHER"

    def poll(self) -> tuple[list[RawConnection], bool]:
        self._permission_limited = False
        results: list[RawConnection] = []

        try:
            conns = psutil.net_connections(kind="inet")
        except (psutil.AccessDenied, PermissionError):
            logger.warning(
                "Insufficient privileges to enumerate all connections. "
                "Run as Administrator/sudo for full visibility."
            )
            self._permission_limited = True
            return ([], True)
        except OSError as exc:
            logger.error("Failed to read connections: %s", exc)
            return ([], True)

        # Periodically clear the cache so terminated PIDs don't accumulate.
        if len(self._proc_cache) > 4096:
            self._proc_cache.clear()

        for c in conns:
            try:
                # Only outbound/established-style connections with a remote peer
                # are interesting; also keep listening sockets out.
                laddr = c.laddr
                raddr = c.raddr
                if not laddr:
                    continue
                local_ip = laddr.ip if hasattr(laddr, "ip") else laddr[0]
                local_port = laddr.port if hasattr(laddr, "port") else laddr[1]
                remote_ip = (raddr.ip if hasattr(raddr, "ip") else raddr[0]) if raddr else None
                remote_port = (
                    raddr.port if hasattr(raddr, "port") else raddr[1]
                ) if raddr else None

                # Skip pure listeners (no remote peer and LISTEN status).
                if remote_ip is None and (c.status in {"LISTEN", _STATUS_NONE, "NONE"}):
                    continue

                name, exe, user = self._process_info(c.pid)
                results.append(
                    RawConnection(
                        pid=c.pid,
                        process_name=name,
                        executable_path=exe,
                        username=user,
                        local_ip=local_ip,
                        local_port=local_port,
                        remote_ip=remote_ip,
                        remote_port=remote_port,
                        protocol=self._protocol(c.type),
                        status=c.status or _STATUS_NONE,
                    )
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess,
                    PermissionError, OSError):
                # Process vanished mid-iteration; skip it.
                continue
            except Exception as exc:  # never let one bad row break the poll
                logger.debug("Skipping connection row: %s", exc)
                continue

        return (results, self._permission_limited)
