"""Convert ORM rows into flat API schema objects."""

from __future__ import annotations

import json

from app.models import Alert, ConnectionRecord
from app.schemas.schemas import AlertOut, ConnectionOut


def connection_to_out(record: ConnectionRecord) -> ConnectionOut:
    proc = record.process
    dest = record.destination
    return ConnectionOut(
        id=record.id,
        pid=proc.pid if proc else None,
        process_name=proc.process_name if proc else None,
        executable_path=proc.executable_path if proc else None,
        local_ip=record.local_ip,
        local_port=record.local_port,
        remote_ip=record.remote_ip,
        remote_port=record.remote_port,
        protocol=record.protocol,
        connection_status=record.connection_status,
        hostname=dest.hostname if dest else None,
        country_code=dest.country_code if dest else None,
        country_name=dest.country_name if dest else None,
        city=dest.city if dest else None,
        latitude=dest.latitude if dest else None,
        longitude=dest.longitude if dest else None,
        organization=dest.organization if dest else None,
        asn=dest.asn if dest else None,
        is_new_destination=False,
        first_seen=record.first_seen,
        last_seen=record.last_seen,
        observation_count=record.observation_count,
        is_active=record.is_active,
        risk_score=record.risk_score,
    )


def alert_to_out(alert: Alert) -> AlertOut:
    evidence = None
    if alert.evidence:
        try:
            evidence = json.loads(alert.evidence)
        except (ValueError, TypeError):
            evidence = {"raw": alert.evidence}
    return AlertOut(
        id=alert.id,
        alert_type=alert.alert_type,
        severity=alert.severity,  # type: ignore[arg-type]
        title=alert.title,
        description=alert.description,
        process_name=alert.process_name,
        remote_ip=alert.remote_ip,
        destination_country=alert.destination_country,
        evidence=evidence,
        created_at=alert.created_at,
        acknowledged=alert.acknowledged,
    )
