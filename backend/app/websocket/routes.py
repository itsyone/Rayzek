"""WebSocket endpoint that streams live events to the frontend."""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.serializers import connection_to_out
from app.core.logging_config import get_logger
from app.database.session import SessionLocal
from app.models import ConnectionRecord
from app.websocket.hub import hub

logger = get_logger("rayzek.ws.route")

router = APIRouter()


def _build_snapshot() -> dict:
    session = SessionLocal()
    try:
        records = session.scalars(
            select(ConnectionRecord)
            .options(
                joinedload(ConnectionRecord.process),
                joinedload(ConnectionRecord.destination),
            )
            .where(ConnectionRecord.is_active.is_(True))
            .order_by(ConnectionRecord.last_seen.desc())
            .limit(500)
        ).unique().all()
        return {
            "connections": [connection_to_out(r).model_dump(mode="json") for r in records]
        }
    finally:
        session.close()


@router.websocket("/ws/live")
async def ws_live(websocket: WebSocket) -> None:
    await hub.connect(websocket)
    try:
        # Send an initial snapshot of the current active connections.
        await websocket.send_json(
            {
                "type": "connection_snapshot",
                "timestamp": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ).isoformat(),
                "data": _build_snapshot(),
            }
        )
        # Keep the socket open; we only need to read pings/close frames.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket closed: %s", exc)
    finally:
        await hub.disconnect(websocket)
