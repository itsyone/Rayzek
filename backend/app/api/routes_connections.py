"""Connection listing and detail endpoints with filtering/sorting/pagination."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.serializers import connection_to_out
from app.database.session import get_session
from app.models import ConnectionRecord, Destination, ProcessRecord
from app.schemas.schemas import ConnectionOut, PaginatedConnections

router = APIRouter(prefix="/connections", tags=["connections"])

_SORT_COLUMNS = {
    "last_seen": ConnectionRecord.last_seen,
    "first_seen": ConnectionRecord.first_seen,
    "risk_score": ConnectionRecord.risk_score,
    "observation_count": ConnectionRecord.observation_count,
    "remote_port": ConnectionRecord.remote_port,
}


@router.get("", response_model=PaginatedConnections)
def list_connections(
    session: Session = Depends(get_session),
    active: bool | None = None,
    process_name: str | None = None,
    remote_ip: str | None = None,
    country: str | None = None,
    protocol: str | None = None,
    status: str | None = None,
    min_risk: int = Query(0, ge=0, le=100),
    search: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    sort_by: Literal[
        "last_seen", "first_seen", "risk_score", "observation_count", "remote_port"
    ] = "last_seen",
    sort_order: Literal["asc", "desc"] = "desc",
) -> PaginatedConnections:
    stmt = (
        select(ConnectionRecord)
        .options(
            joinedload(ConnectionRecord.process),
            joinedload(ConnectionRecord.destination),
        )
        .join(ProcessRecord, ConnectionRecord.process_id == ProcessRecord.id, isouter=True)
        .join(Destination, ConnectionRecord.destination_id == Destination.id, isouter=True)
    )

    if active is not None:
        stmt = stmt.where(ConnectionRecord.is_active.is_(active))
    if process_name:
        stmt = stmt.where(ProcessRecord.process_name.ilike(f"%{process_name}%"))
    if remote_ip:
        stmt = stmt.where(ConnectionRecord.remote_ip == remote_ip)
    if country:
        stmt = stmt.where(Destination.country_code == country.upper())
    if protocol:
        stmt = stmt.where(ConnectionRecord.protocol == protocol.upper())
    if status:
        stmt = stmt.where(ConnectionRecord.connection_status == status.upper())
    if min_risk:
        stmt = stmt.where(ConnectionRecord.risk_score >= min_risk)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            ProcessRecord.process_name.ilike(like)
            | ConnectionRecord.remote_ip.ilike(like)
            | Destination.hostname.ilike(like)
            | Destination.country_name.ilike(like)
        )

    total = session.scalar(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ) or 0

    column = _SORT_COLUMNS[sort_by]
    stmt = stmt.order_by(column.asc() if sort_order == "asc" else column.desc())
    stmt = stmt.limit(limit).offset(offset)

    records = session.scalars(stmt).unique().all()
    return PaginatedConnections(
        items=[connection_to_out(r) for r in records],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{connection_id}", response_model=ConnectionOut)
def get_connection(
    connection_id: int, session: Session = Depends(get_session)
) -> ConnectionOut:
    record = session.scalars(
        select(ConnectionRecord)
        .options(
            joinedload(ConnectionRecord.process),
            joinedload(ConnectionRecord.destination),
        )
        .where(ConnectionRecord.id == connection_id)
    ).first()
    if record is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return connection_to_out(record)
