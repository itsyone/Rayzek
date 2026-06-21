"""Destination listing and detail endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.serializers import connection_to_out
from app.database.session import get_session
from app.models import ConnectionRecord, Destination
from app.schemas.schemas import ConnectionOut, DestinationOut

router = APIRouter(prefix="/destinations", tags=["destinations"])


@router.get("", response_model=list[DestinationOut])
def list_destinations(
    session: Session = Depends(get_session),
    country: str | None = None,
    search: str | None = None,
    include_private: bool = False,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[DestinationOut]:
    stmt = select(Destination)
    if not include_private:
        stmt = stmt.where(Destination.is_private.is_(False))
    if country:
        stmt = stmt.where(Destination.country_code == country.upper())
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            Destination.ip_address.ilike(like)
            | Destination.hostname.ilike(like)
            | Destination.organization.ilike(like)
            | Destination.country_name.ilike(like)
        )
    stmt = stmt.order_by(Destination.last_seen.desc()).limit(limit).offset(offset)
    return [DestinationOut.model_validate(d) for d in session.scalars(stmt).all()]


@router.get("/{ip_address}", response_model=DestinationOut)
def get_destination(
    ip_address: str, session: Session = Depends(get_session)
) -> DestinationOut:
    dest = session.scalars(
        select(Destination).where(Destination.ip_address == ip_address)
    ).first()
    if dest is None:
        raise HTTPException(status_code=404, detail="Destination not found")
    return DestinationOut.model_validate(dest)


@router.get("/{ip_address}/connections", response_model=list[ConnectionOut])
def destination_connections(
    ip_address: str, session: Session = Depends(get_session)
) -> list[ConnectionOut]:
    records = session.scalars(
        select(ConnectionRecord)
        .options(
            joinedload(ConnectionRecord.process),
            joinedload(ConnectionRecord.destination),
        )
        .where(ConnectionRecord.remote_ip == ip_address)
        .order_by(ConnectionRecord.last_seen.desc())
        .limit(500)
    ).unique().all()
    return [connection_to_out(r) for r in records]


@router.get("/{ip_address}/ports")
def destination_ports(
    ip_address: str, session: Session = Depends(get_session)
) -> list[dict]:
    rows = session.execute(
        select(
            ConnectionRecord.remote_port,
            func.count().label("count"),
        )
        .where(ConnectionRecord.remote_ip == ip_address)
        .group_by(ConnectionRecord.remote_port)
        .order_by(func.count().desc())
    ).all()
    return [{"port": r[0], "count": r[1]} for r in rows]
