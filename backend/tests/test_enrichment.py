import asyncio

from app.core.config import Settings
from app.services.enrichment import EnrichmentService


def test_private_ip_not_sent_to_provider():
    settings = Settings(geolocation_enabled=True, geo_provider_url="http://example/{ip}")
    svc = EnrichmentService(settings)
    result = asyncio.run(svc.enrich("192.168.1.10"))
    assert result.ok is False
    assert "Local" in (result.organization or "")


def test_fallback_when_geolocation_disabled():
    settings = Settings(geolocation_enabled=False, hostname_resolution_enabled=False)
    svc = EnrichmentService(settings)
    result = asyncio.run(svc.enrich("8.8.8.8"))
    assert result.country_name == "Unknown location"
    assert result.organization == "Unknown organization"


def test_empty_ip_is_safe():
    settings = Settings(geolocation_enabled=False)
    svc = EnrichmentService(settings)
    result = asyncio.run(svc.enrich(None))
    assert result.ok is False
