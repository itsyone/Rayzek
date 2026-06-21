"""CSV export endpoints for connections and alerts."""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database.session import get_session
from app.models import Alert, ConnectionRecord

router = APIRouter(prefix="/export", tags=["export"])


def _csv_response(rows: list[list], header: list[str], filename: str) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/connections.csv")
def export_connections(session: Session = Depends(get_session)) -> StreamingResponse:
    records = session.scalars(
        select(ConnectionRecord)
        .options(
            joinedload(ConnectionRecord.process),
            joinedload(ConnectionRecord.destination),
        )
        .order_by(ConnectionRecord.last_seen.desc())
        .limit(10000)
    ).unique().all()

    header = [
        "process_name", "pid", "local_ip", "local_port", "remote_ip", "remote_port",
        "protocol", "status", "hostname", "country", "organization",
        "first_seen", "last_seen", "observations", "active", "risk_score",
    ]
    rows = [
        [
            r.process.process_name if r.process else "",
            r.process.pid if r.process else "",
            r.local_ip,
            r.local_port,
            r.remote_ip or "",
            r.remote_port or "",
            r.protocol,
            r.connection_status,
            r.destination.hostname if r.destination else "",
            r.destination.country_name if r.destination else "",
            r.destination.organization if r.destination else "",
            r.first_seen.isoformat(),
            r.last_seen.isoformat(),
            r.observation_count,
            r.is_active,
            r.risk_score,
        ]
        for r in records
    ]
    return _csv_response(rows, header, "rayzek-connections.csv")


@router.get("/alerts.csv")
def export_alerts(session: Session = Depends(get_session)) -> StreamingResponse:
    alerts = session.scalars(
        select(Alert).order_by(Alert.created_at.desc()).limit(10000)
    ).all()
    header = [
        "created_at", "severity", "alert_type", "title", "process_name",
        "remote_ip", "destination_country", "acknowledged", "evidence",
    ]
    rows = [
        [
            a.created_at.isoformat(),
            a.severity,
            a.alert_type,
            a.title,
            a.process_name or "",
            a.remote_ip or "",
            a.destination_country or "",
            a.acknowledged,
            a.evidence or "",
        ]
        for a in alerts
    ]
    return _csv_response(rows, header, "rayzek-alerts.csv")
