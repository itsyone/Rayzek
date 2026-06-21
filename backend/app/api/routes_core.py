"""Health, stats, collector control, and settings endpoints."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import __version__
from app.api.deps import get_collector
from app.core.config import get_settings
from app.core.runtime import runtime
from app.database.session import engine, get_session
from app.models import Alert, ApplicationSetting, ConnectionRecord, Destination, ProcessRecord
from app.schemas.schemas import (
    CollectorStatus,
    HealthOut,
    SettingsUpdate,
    StatsOut,
)

router = APIRouter()


def _collector_status_label() -> str:
    collector = get_collector()
    if collector is None:
        return "stopped"
    return "running" if collector.state.running else "stopped"


@router.get("/health", response_model=HealthOut, tags=["system"])
def health() -> HealthOut:
    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
    except Exception:
        db_status = "error"

    collector = get_collector()
    return HealthOut(
        status="ok",
        database=db_status,
        collector=_collector_status_label(),
        demo_mode=bool(collector and collector.state.demo_mode),
        platform=__import__("platform").system(),
        version=__version__,
        uptime_seconds=round(runtime.uptime_seconds, 2),
    )


@router.get("/config", tags=["system"])
def client_config(session: Session = Depends(get_session)) -> dict:
    """Public, non-secret configuration the frontend needs (map + origin).

    User-saved values (Settings page, stored in the DB) take precedence over
    environment defaults so the map origin and style are actually editable.
    """
    s = get_settings()
    collector = get_collector()

    overrides = {
        row.key: row.value for row in session.scalars(select(ApplicationSetting)).all()
    }

    def _float(key: str, default: float) -> float:
        try:
            return float(overrides[key])
        except (KeyError, ValueError, TypeError):
            return default

    map_style = overrides.get("map_style_url") or s.map_style_url
    return {
        "map_style_url": map_style,
        "origin": {
            "latitude": _float("origin_latitude", s.origin_latitude),
            "longitude": _float("origin_longitude", s.origin_longitude),
        },
        "geolocation_enabled": s.geolocation_enabled,
        "hostname_resolution_enabled": s.hostname_resolution_enabled,
        "demo_mode": bool(collector and collector.state.demo_mode),
        "platform": __import__("platform").system(),
        "version": __version__,
        "tshark_enabled": s.tshark_enabled,
    }


@router.get("/stats", response_model=StatsOut, tags=["system"])
def stats(session: Session = Depends(get_session)) -> StatsOut:
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

    active_connections = session.scalar(
        select(func.count()).select_from(ConnectionRecord).where(
            ConnectionRecord.is_active.is_(True)
        )
    ) or 0
    active_processes = session.scalar(
        select(func.count(func.distinct(ConnectionRecord.process_id))).where(
            ConnectionRecord.is_active.is_(True)
        )
    ) or 0
    unique_destinations = session.scalar(
        select(func.count()).select_from(Destination)
    ) or 0
    countries = session.scalar(
        select(func.count(func.distinct(Destination.country_code))).where(
            Destination.country_code.is_not(None)
        )
    ) or 0
    new_dest_today = session.scalar(
        select(func.count()).select_from(Destination).where(Destination.first_seen >= today)
    ) or 0
    alerts_today = session.scalar(
        select(func.count()).select_from(Alert).where(Alert.created_at >= today)
    ) or 0
    total_connections = session.scalar(
        select(func.count()).select_from(ConnectionRecord)
    ) or 0

    return StatsOut(
        active_connections=active_connections,
        active_processes=active_processes,
        unique_destinations=unique_destinations,
        countries_connected=countries,
        new_destinations_today=new_dest_today,
        alerts_today=alerts_today,
        total_connections=total_connections,
        collector_status=_collector_status_label(),
    )


@router.get("/collector/status", response_model=CollectorStatus, tags=["collector"])
def collector_status() -> CollectorStatus:
    collector = get_collector()
    if collector is None:
        return CollectorStatus(
            status="stopped", running=False, demo_mode=False, poll_interval=1.0
        )
    st = collector.state
    return CollectorStatus(
        status="running" if st.running else "stopped",
        running=st.running,
        demo_mode=st.demo_mode,
        poll_interval=st.poll_interval,
        last_poll=st.last_poll,
        permission_limited=st.permission_limited,
    )


@router.post("/collector/start", response_model=CollectorStatus, tags=["collector"])
async def collector_start() -> CollectorStatus:
    collector = get_collector()
    if collector is not None:
        await collector.start()
    return collector_status()


@router.post("/collector/stop", response_model=CollectorStatus, tags=["collector"])
async def collector_stop() -> CollectorStatus:
    collector = get_collector()
    if collector is not None:
        await collector.stop()
    return collector_status()


# --------------------------------------------------------------------------- #
# Settings
# --------------------------------------------------------------------------- #
@router.get("/settings", tags=["settings"])
def get_settings_endpoint(session: Session = Depends(get_session)) -> dict[str, str]:
    rows = session.scalars(select(ApplicationSetting)).all()
    return {row.key: row.value for row in rows}


@router.patch("/settings", tags=["settings"])
def update_settings_endpoint(
    payload: SettingsUpdate, session: Session = Depends(get_session)
) -> dict[str, str]:
    for key, value in payload.settings.items():
        row = session.get(ApplicationSetting, key)
        if row is None:
            row = ApplicationSetting(key=key, value=value)
            session.add(row)
        else:
            row.value = value
            row.updated_at = datetime.now(UTC)
    session.commit()

    # Apply runtime-affecting settings immediately where possible.
    collector = get_collector()
    if collector is not None and "poll_interval" in payload.settings:
        try:
            collector.set_poll_interval(float(payload.settings["poll_interval"]))
        except ValueError:
            pass
    if collector is not None:
        threshold_keys = {
            "burst_threshold",
            "many_countries_threshold",
            "failure_threshold",
        }
        thresholds = {
            k: int(v)
            for k, v in payload.settings.items()
            if k in threshold_keys and v.isdigit()
        }
        if thresholds:
            collector.alert_engine.update_thresholds(thresholds)

    rows = session.scalars(select(ApplicationSetting)).all()
    return {row.key: row.value for row in rows}


@router.delete("/history", tags=["settings"])
def clear_history(session: Session = Depends(get_session)) -> dict[str, str]:
    """Clear stored connection/alert/destination history (privacy control)."""
    session.query(ConnectionRecord).delete()
    session.query(Alert).delete()
    session.query(Destination).delete()
    session.query(ProcessRecord).delete()
    session.commit()
    return {"status": "cleared"}
