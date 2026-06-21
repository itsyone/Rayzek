"""Database persistence helpers used by the collector.

These functions keep exactly one row per logical entity (process / destination /
connection identity) and update counters in place rather than inserting a new
row on every poll.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ConnectionRecord, Destination, ProcessRecord
from app.services.geo_provider import GeoResult
from app.utils.netutils import classify_ip


def _utcnow() -> datetime:
    return datetime.now(UTC)


def upsert_process(
    session: Session,
    *,
    pid: int,
    name: str,
    exe: str | None,
    username: str | None,
) -> ProcessRecord:
    stmt = select(ProcessRecord).where(
        ProcessRecord.pid == pid, ProcessRecord.process_name == name
    )
    proc = session.scalars(stmt).first()
    now = _utcnow()
    if proc is None:
        proc = ProcessRecord(
            pid=pid,
            process_name=name,
            executable_path=exe,
            username=username,
            first_seen=now,
            last_seen=now,
        )
        session.add(proc)
        session.flush()
    else:
        proc.last_seen = now
        if exe and not proc.executable_path:
            proc.executable_path = exe
        if username and not proc.username:
            proc.username = username
    return proc


def upsert_destination(session: Session, ip: str | None) -> Destination | None:
    if not ip:
        return None
    dest = session.scalars(
        select(Destination).where(Destination.ip_address == ip)
    ).first()
    now = _utcnow()
    if dest is None:
        dest = Destination(
            ip_address=ip,
            is_private=classify_ip(ip) != "public",
            first_seen=now,
            last_seen=now,
            observation_count=1,
        )
        session.add(dest)
        session.flush()
    else:
        dest.last_seen = now
        dest.observation_count += 1
    return dest


def apply_enrichment(session: Session, ip: str, geo: GeoResult) -> Destination | None:
    dest = session.scalars(
        select(Destination).where(Destination.ip_address == ip)
    ).first()
    if dest is None:
        return None
    dest.hostname = geo.hostname or dest.hostname
    dest.country_code = geo.country_code or dest.country_code
    dest.country_name = geo.country_name or dest.country_name
    dest.city = geo.city or dest.city
    dest.latitude = geo.latitude if geo.latitude is not None else dest.latitude
    dest.longitude = geo.longitude if geo.longitude is not None else dest.longitude
    dest.organization = geo.organization or dest.organization
    dest.asn = geo.asn or dest.asn
    dest.enriched = True
    session.flush()
    return dest


def get_connection(
    session: Session,
    *,
    process_id: int,
    local_port: int,
    remote_ip: str | None,
    remote_port: int | None,
    protocol: str,
) -> ConnectionRecord | None:
    stmt = select(ConnectionRecord).where(
        ConnectionRecord.process_id == process_id,
        ConnectionRecord.local_port == local_port,
        ConnectionRecord.remote_ip == remote_ip,
        ConnectionRecord.remote_port == remote_port,
        ConnectionRecord.protocol == protocol,
    )
    return session.scalars(stmt).first()


def is_new_destination_for_process(
    session: Session, process_id: int, remote_ip: str | None
) -> bool:
    if not remote_ip:
        return False
    existing = session.scalars(
        select(ConnectionRecord.id).where(
            ConnectionRecord.process_id == process_id,
            ConnectionRecord.remote_ip == remote_ip,
        )
    ).first()
    return existing is None
