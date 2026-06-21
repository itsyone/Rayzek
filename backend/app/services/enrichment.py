"""Destination enrichment: reverse DNS + geolocation, with caching and guards."""

from __future__ import annotations

import asyncio
import socket
import time
from dataclasses import dataclass

from app.core.config import Settings
from app.core.logging_config import get_logger
from app.services.geo_provider import GeoProvider, GeoResult, build_provider
from app.utils.netutils import is_non_public_ip

logger = get_logger("rayzek.enrichment")


@dataclass
class _CacheEntry:
    result: GeoResult
    expires_at: float


class EnrichmentService:
    """Resolves hostname + geolocation for public IPs only.

    Private/loopback/reserved addresses are never sent to external providers.
    Results are cached in memory with a configurable TTL, and in-flight
    lookups for the same IP are de-duplicated.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._provider: GeoProvider = build_provider(settings)
        self._cache: dict[str, _CacheEntry] = {}
        self._inflight: dict[str, asyncio.Lock] = {}
        self._ttl = max(settings.destination_cache_ttl_hours, 0) * 3600

    def _cached(self, ip: str) -> GeoResult | None:
        entry = self._cache.get(ip)
        if entry and (self._ttl == 0 or entry.expires_at > time.monotonic()):
            return entry.result
        return None

    def _store(self, ip: str, result: GeoResult) -> None:
        self._cache[ip] = _CacheEntry(
            result=result, expires_at=time.monotonic() + (self._ttl or 86400)
        )

    async def _reverse_dns(self, ip: str) -> str | None:
        if not self._settings.hostname_resolution_enabled:
            return None
        try:
            loop = asyncio.get_running_loop()
            host = await asyncio.wait_for(
                loop.run_in_executor(None, _safe_gethostbyaddr, ip), timeout=3.0
            )
            return host
        except TimeoutError:
            return None
        except Exception:
            return None

    async def enrich(self, ip: str | None) -> GeoResult:
        """Return enrichment for an IP. Safe for any input."""
        if not ip:
            return GeoResult(ip_address="", ok=False)

        if is_non_public_ip(ip):
            return GeoResult(
                ip_address=ip,
                hostname=None,
                country_name="Private / local network",
                organization="Local network",
                ok=False,
            )

        cached = self._cached(ip)
        if cached is not None:
            return cached

        lock = self._inflight.setdefault(ip, asyncio.Lock())
        async with lock:
            cached = self._cached(ip)
            if cached is not None:
                return cached

            hostname_task = asyncio.create_task(self._reverse_dns(ip))
            geo: GeoResult = GeoResult(ip_address=ip, ok=False)
            if self._settings.geolocation_enabled:
                try:
                    geo = await self._provider.lookup_ip(ip)
                except Exception as exc:
                    logger.warning("Provider error for %s: %s", ip, exc)
            hostname = await hostname_task
            if hostname:
                geo.hostname = hostname
            if not geo.country_name:
                geo.country_name = "Unknown location"
            if not geo.organization:
                geo.organization = "Unknown organization"

            self._store(ip, geo)
            self._inflight.pop(ip, None)
            return geo

    async def health_check(self) -> bool:
        try:
            return await self._provider.health_check()
        except Exception:
            return False


def _safe_gethostbyaddr(ip: str) -> str | None:
    try:
        return socket.gethostbyaddr(ip)[0]
    except (socket.herror, socket.gaierror, OSError):
        return None
