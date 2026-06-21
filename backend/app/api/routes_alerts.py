"""Alert listing, detail, and acknowledgement endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.serializers import alert_to_out
from app.database.session import get_session
from app.models import Alert
from app.schemas.schemas import AlertOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    session: Session = Depends(get_session),
    severity: str | None = None,
    alert_type: str | None = None,
    acknowledged: bool | None = None,
    process_name: str | None = None,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[AlertOut]:
    stmt = select(Alert)
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    if alert_type:
        stmt = stmt.where(Alert.alert_type == alert_type)
    if acknowledged is not None:
        stmt = stmt.where(Alert.acknowledged.is_(acknowledged))
    if process_name:
        stmt = stmt.where(Alert.process_name.ilike(f"%{process_name}%"))
    stmt = stmt.order_by(Alert.created_at.desc()).limit(limit).offset(offset)
    return [alert_to_out(a) for a in session.scalars(stmt).all()]


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: int, session: Session = Depends(get_session)) -> AlertOut:
    alert = session.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert_to_out(alert)


@router.patch("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(
    alert_id: int, session: Session = Depends(get_session)
) -> AlertOut:
    alert = session.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    session.commit()
    return alert_to_out(alert)
