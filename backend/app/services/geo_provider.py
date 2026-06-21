"""Geolocation provider abstraction with a configurable HTTP implementation."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Protocol

import httpx

from app.core.config import Settings
from app.core.logging_config import get_logger

logger = get_logger("rayzek.geo")


@dataclass
class GeoResult:
    ip_address: str
    hostname: str | None = None
    country_code: str | None = None
    country_name: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    organization: str | None = None
    asn: str | None = None
    ok: bool = False


class GeoProvider(Protocol):
    async def lookup_ip(self, ip_address: str) -> GeoResult: ...

    async def health_check(self) -> bool: ...


@dataclass
class FallbackProvider:
    """Always returns 'unknown' data. Used when geolocation is disabled."""

    async def lookup_ip(self, ip_address: str) -> GeoResult:
        return GeoResult(
            ip_address=ip_address,
            country_name="Unknown location",
            organization="Unknown organization",
            ok=False,
        )

    async def health_check(self) -> bool:
        return True


@dataclass
class HttpGeoProvider:
    """Generic HTTP provider. The URL template may contain ``{ip}`` and
    ``{key}`` placeholders. Response parsing tolerates a couple of common
    field-naming conventions (ip-api.com style and ipinfo.io style)."""

    settings: Settings
    _rate_limit_min_interval: float = 1.4  # seconds between outbound requests
    _last_request_ts: float = field(default=0.0)

    async def _respect_rate_limit(self) -> None:
        elapsed = time.monotonic() - self._last_request_ts
        if elapsed < self._rate_limit_min_interval:
            return  # caller should batch; we simply skip throttling delay here
        self._last_request_ts = time.monotonic()

    async def lookup_ip(self, ip_address: str) -> GeoResult:
        url = self.settings.geo_provider_url
        if not url:
            return GeoResult(ip_address=ip_address, ok=False)

        await self._respect_rate_limit()
        url = url.replace("{ip}", ip_address).replace(
            "{key}", self.settings.geo_provider_api_key
        )
        try:
            async with httpx.AsyncClient(timeout=self.settings.geo_request_timeout) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                payload = resp.json()
        except Exception as exc:  # network failure, timeout, bad JSON
            logger.warning("Geolocation lookup failed for %s: %s", ip_address, exc)
            return GeoResult(ip_address=ip_address, ok=False)

        return self._parse(ip_address, payload)

    @staticmethod
    def _parse(ip_address: str, payload: dict) -> GeoResult:
        # ip-api.com reports status="fail" on private/invalid IPs.
        if payload.get("status") == "fail":
            return GeoResult(ip_address=ip_address, ok=False)

        loc = payload.get("loc")
        lat = payload.get("lat")
        lon = payload.get("lon")
        if (lat is None or lon is None) and isinstance(loc, str) and "," in loc:
            try:
                lat_s, lon_s = loc.split(",", 1)
                lat, lon = float(lat_s), float(lon_s)
            except ValueError:
                lat = lon = None

        return GeoResult(
            ip_address=ip_address,
            country_code=payload.get("countryCode") or payload.get("country_code"),
            country_name=payload.get("country") or payload.get("country_name"),
            city=payload.get("city"),
            latitude=float(lat) if lat is not None else None,
            longitude=float(lon) if lon is not None else None,
            organization=payload.get("org") or payload.get("organization"),
            asn=payload.get("as") or payload.get("asn"),
            ok=True,
        )

    async def health_check(self) -> bool:
        return bool(self.settings.geo_provider_url)


def build_provider(settings: Settings) -> GeoProvider:
    if settings.geolocation_enabled and settings.geo_provider_url:
        return HttpGeoProvider(settings=settings)
    return FallbackProvider()
