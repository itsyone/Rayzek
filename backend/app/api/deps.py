"""Shared FastAPI dependencies."""

from __future__ import annotations

from app.core.runtime import runtime
from app.services.collector import CollectorService


def get_collector() -> CollectorService | None:
    return runtime.collector


def require_collector() -> CollectorService:
    if runtime.collector is None:
        raise RuntimeError("Collector is not initialised")
    return runtime.collector
