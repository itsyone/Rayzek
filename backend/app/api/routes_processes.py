"""Process listing and detail endpoints with connection statistics."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.serializers import connection_to_out
from app.database.session import get_session
from app.models import ConnectionRecord, Destination, ProcessRecord
from app.schemas.schemas import ConnectionOut, ProcessStats

router = APIRouter(prefix="/processes", tags=["processes"])


def _process_stats(session: Session, proc: ProcessRecord) -> ProcessStats:
    active = session.scalar(
        select(func.count()).select_from(ConnectionRecord).where(
            ConnectionRecord.process_id == proc.id,
            ConnectionRecord.is_active.is_(True),
        )
    ) or 0
    unique_dest = session.scalar(
        select(func.count(func.distinct(ConnectionRecord.remote_ip))).where(
            ConnectionRecord.process_id == proc.id,
            ConnectionRecord.remote_ip.is_not(None),
        )
    ) or 0
    countries = session.scalar(
        select(func.count(func.distinct(Destination.country_code)))
        .select_from(ConnectionRecord)
        .join(Destination, ConnectionRecord.destination_id == Destination.id)
        .where(
            ConnectionRecord.process_id == proc.id,
            Destination.country_code.is_not(None),
        )
    ) or 0
    total_obs = session.scalar(
        select(func.coalesce(func.sum(ConnectionRecord.observation_count), 0)).where(
            ConnectionRecord.process_id == proc.id
        )
    ) or 0
    max_risk = session.scalar(
        select(func.coalesce(func.max(ConnectionRecord.risk_score), 0)).where(
            ConnectionRecord.process_id == proc.id
        )
    ) or 0

    return ProcessStats(
        id=proc.id,
        pid=proc.pid,
        process_name=proc.process_name,
        executable_path=proc.executable_path,
        username=proc.username,
        first_seen=proc.first_seen,
        last_seen=proc.last_seen,
        active_connections=active,
        unique_destinations=unique_dest,
        countries=countries,
        total_observations=total_obs,
        max_risk=max_risk,
    )


@router.get("", response_model=list[ProcessStats])
def list_processes(session: Session = Depends(get_session)) -> list[ProcessStats]:
    procs = session.scalars(
        select(ProcessRecord).order_by(ProcessRecord.last_seen.desc())
    ).all()
    return [_process_stats(session, p) for p in procs]


@router.get("/{pid}", response_model=ProcessStats)
def get_process(pid: int, session: Session = Depends(get_session)) -> ProcessStats:
    proc = session.scalars(
        select(ProcessRecord)
        .where(ProcessRecord.pid == pid)
        .order_by(ProcessRecord.last_seen.desc())
    ).first()
    if proc is None:
        raise HTTPException(status_code=404, detail="Process not found")
    return _process_stats(session, proc)


@router.get("/{pid}/connections", response_model=list[ConnectionOut])
def process_connections(
    pid: int, session: Session = Depends(get_session)
) -> list[ConnectionOut]:
    proc = session.scalars(
        select(ProcessRecord).where(ProcessRecord.pid == pid)
    ).first()
    if proc is None:
        raise HTTPException(status_code=404, detail="Process not found")
    records = session.scalars(
        select(ConnectionRecord)
        .options(
            joinedload(ConnectionRecord.process),
            joinedload(ConnectionRecord.destination),
        )
        .where(ConnectionRecord.process_id == proc.id)
        .order_by(ConnectionRecord.last_seen.desc())
        .limit(500)
    ).unique().all()
    return [connection_to_out(r) for r in records]
