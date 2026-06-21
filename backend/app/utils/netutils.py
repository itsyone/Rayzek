"""Network address helpers: classification, port heuristics, identity keys."""

from __future__ import annotations

import ipaddress
from dataclasses import dataclass

# Ports that are commonly used for legitimate outbound traffic. Anything
# outside this set is flagged as "uncommon" by the alert engine (conservatively).
COMMON_REMOTE_PORTS: frozenset[int] = frozenset(
    {
        80,
        443,
        53,
        853,  # DNS over TLS
        123,  # NTP
        22,
        21,
        25,
        587,
        465,
        993,
        995,
        143,
        110,
        3478,  # STUN/WebRTC
        5222,  # XMPP
        8080,
        8443,
    }
)


def is_non_public_ip(ip: str | None) -> bool:
    """Return True for private, loopback, link-local, multicast, reserved, etc.

    These addresses must never be sent to external geolocation providers.
    """
    if not ip:
        return True
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def classify_ip(ip: str | None) -> str:
    """Human-readable classification of an address."""
    if not ip:
        return "unknown"
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return "invalid"
    if addr.is_loopback:
        return "loopback"
    if addr.is_link_local:
        return "link-local"
    if addr.is_private:
        return "private"
    if addr.is_multicast:
        return "multicast"
    if addr.is_reserved or addr.is_unspecified:
        return "reserved"
    return "public"


# Genuinely notable ports worth a heads-up when seen as a remote destination.
# We deliberately do NOT flag high/ephemeral ports — those are normal for VPNs,
# WebRTC, games, and P2P, and flagging them produces constant false positives.
NOTABLE_REMOTE_PORTS: frozenset[int] = frozenset(
    {
        23,    # Telnet
        3389,  # RDP
        445,   # SMB
        135,   # RPC
        1433,  # MSSQL
        3306,  # MySQL
        5432,  # PostgreSQL
        6379,  # Redis
        4444,  # common reverse-shell / Metasploit default
        1337,
        31337,
        6667,  # IRC
    }
)


def is_uncommon_port(port: int | None) -> bool:
    """Conservative: only flag a small curated set of notable remote ports.

    Normal browsing and VPN/P2P traffic uses a huge spread of ports; flagging
    anything outside a "common" list creates non-stop noise, so we instead flag
    only ports that are genuinely interesting on an outbound connection.
    """
    if port is None or port in COMMON_REMOTE_PORTS:
        return False
    return port in NOTABLE_REMOTE_PORTS


@dataclass(frozen=True)
class ConnectionIdentity:
    """Stable in-memory identity used to deduplicate observations."""

    pid: int
    local_ip: str
    local_port: int
    remote_ip: str | None
    remote_port: int | None
    protocol: str

    def key(self) -> str:
        return (
            f"{self.pid}|{self.local_ip}:{self.local_port}|"
            f"{self.remote_ip}:{self.remote_port}|{self.protocol}"
        )
