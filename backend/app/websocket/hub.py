"""WebSocket connection hub for broadcasting live events to the frontend."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket

from app.core.logging_config import get_logger

logger = get_logger("rayzek.ws")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class EventHub:
    """Tracks connected WebSocket clients and fans out structured events.

    A reference to the running event loop is captured so that the collector
    (which runs in a background asyncio task) and synchronous code paths can
    both schedule broadcasts safely.
    """

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    @property
    def client_count(self) -> int:
        return len(self._clients)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)
        logger.info("WebSocket client connected (%d total)", self.client_count)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(websocket)
        logger.info("WebSocket client disconnected (%d total)", self.client_count)

    async def broadcast(self, event_type: str, data: dict[str, Any]) -> None:
        """Send an event to every connected client. Never raises."""
        if not self._clients:
            return
        payload = {"type": event_type, "timestamp": _now_iso(), "data": data}
        stale: list[WebSocket] = []
        for client in list(self._clients):
            try:
                await client.send_json(payload)
            except Exception:  # client gone / send failed
                stale.append(client)
        if stale:
            async with self._lock:
                for client in stale:
                    self._clients.discard(client)

    def broadcast_threadsafe(self, event_type: str, data: dict[str, Any]) -> None:
        """Schedule a broadcast from synchronous / non-loop code."""
        if self._loop is None or not self._clients:
            return
        try:
            asyncio.run_coroutine_threadsafe(
                self.broadcast(event_type, data), self._loop
            )
        except RuntimeError:
            pass


# Module-level singleton shared across the app.
hub = EventHub()
