"""Aggregated history endpoints used by charts and playback."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.serializers import connection_to_out
from app.database.session import get_session
from app.models import ConnectionRecord, Destination
from app.schemas.schemas import ConnectionOut

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/timeline")
def timeline(
    session: Session = Depends(get_session),
    hours: int = Query(24, ge=1, le=720),
) -> list[dict]:
    """Connections first-seen per hour bucket over the requested window."""
    since = datetime.now(UTC) - timedelta(hours=hours)
    rows = session.execute(
        select(
            func.strftime("%Y-%m-%dT%H:00:00", ConnectionRecord.first_seen).label("bucket"),
            func.count().label("count"),
        )
        .where(ConnectionRecord.first_seen >= since)
        .group_by("bucket")
        .order_by("bucket")
    ).all()
    return [{"bucket": r[0], "count": r[1]} for r in rows]


@router.get("/by-country")
def by_country(session: Session = Depends(get_session)) -> list[dict]:
    rows = session.execute(
        select(
            Destination.country_code,
            Destination.country_name,
            func.count(ConnectionRecord.id).label("count"),
        )
        .select_from(ConnectionRecord)
        .join(Destination, ConnectionRecord.destination_id == Destination.id)
        .where(Destination.country_code.is_not(None))
        .group_by(Destination.country_code, Destination.country_name)
        .order_by(func.count(ConnectionRecord.id).desc())
        .limit(50)
    ).all()
    return [
        {"country_code": r[0], "country_name": r[1], "count": r[2]} for r in rows
    ]


@router.get("/by-process")
def by_process(session: Session = Depends(get_session)) -> list[dict]:
    from app.models import ProcessRecord

    rows = session.execute(
        select(
            ProcessRecord.process_name,
            func.count(ConnectionRecord.id).label("count"),
        )
        .select_from(ConnectionRecord)
        .join(ProcessRecord, ConnectionRecord.process_id == ProcessRecord.id)
        .group_by(ProcessRecord.process_name)
        .order_by(func.count(ConnectionRecord.id).desc())
        .limit(25)
    ).all()
    return [{"process_name": r[0], "count": r[1]} for r in rows]


@router.get("/playback", response_model=list[ConnectionOut])
def playback(
    session: Session = Depends(get_session),
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(2000, ge=1, le=10000),
) -> list[ConnectionOut]:
    """Return connections in a time range ordered by first_seen for replay."""
    stmt = (
        select(ConnectionRecord)
        .options(
            joinedload(ConnectionRecord.process),
            joinedload(ConnectionRecord.destination),
        )
    )
    if start:
        stmt = stmt.where(ConnectionRecord.first_seen >= start)
    if end:
        stmt = stmt.where(ConnectionRecord.first_seen <= end)
    stmt = stmt.order_by(ConnectionRecord.first_seen.asc()).limit(limit)
    records = session.scalars(stmt).unique().all()
    return [connection_to_out(r) for r in records]
