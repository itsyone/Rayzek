"""Rayzek FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import (
    routes_alerts,
    routes_connections,
    routes_core,
    routes_destinations,
    routes_export,
    routes_history,
    routes_processes,
)
from app.core.config import get_settings
from app.core.logging_config import configure_logging, get_logger
from app.core.runtime import runtime
from app.database.session import SessionLocal, init_db
from app.services.collector import CollectorService
from app.websocket import routes as ws_routes
from app.websocket.hub import hub

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger("rayzek.main")


def _apply_retention() -> None:
    """Delete records older than the retention window (0 = keep forever)."""
    if settings.retention_days <= 0:
        return
    cutoff = datetime.now(UTC) - timedelta(days=settings.retention_days)
    from app.models import Alert, ConnectionRecord

    session = SessionLocal()
    try:
        session.query(ConnectionRecord).filter(
            ConnectionRecord.last_seen < cutoff,
            ConnectionRecord.is_active.is_(False),
        ).delete(synchronize_session=False)
        session.query(Alert).filter(Alert.created_at < cutoff).delete(
            synchronize_session=False
        )
        session.commit()
    except Exception as exc:
        logger.warning("Retention cleanup failed: %s", exc)
        session.rollback()
    finally:
        session.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Rayzek backend v%s on %s", __version__, settings.platform_name)
    init_db()
    logger.info("Database initialised (%s)", settings.database_url)
    _apply_retention()

    hub.bind_loop(asyncio.get_running_loop())

    collector = CollectorService(settings)
    runtime.collector = collector
    if settings.start_collector_automatically:
        await collector.start()
    else:
        logger.info("Collector autostart disabled; start it from the UI or API.")

    try:
        yield
    finally:
        logger.info("Shutting down Rayzek backend.")
        if runtime.collector is not None:
            await runtime.collector.stop()


app = FastAPI(
    title="Rayzek",
    description="See where your computer is talking. Local network visibility.",
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers under /api
for module in (
    routes_core,
    routes_connections,
    routes_processes,
    routes_destinations,
    routes_alerts,
    routes_history,
    routes_export,
):
    app.include_router(module.router, prefix="/api")

# WebSocket (no /api prefix)
app.include_router(ws_routes.router)


# --------------------------------------------------------------------------- #
# Static frontend (production / packaged desktop build)
#
# When a built frontend is available (env RAYZEK_STATIC_DIR, or backend/static,
# or ../frontend/dist) we serve it from the same origin as the API. The SPA then
# uses same-origin /api and /ws/live with no proxy. In dev (no build present)
# the root returns JSON and Vite serves the UI instead.
# --------------------------------------------------------------------------- #
def _resolve_static_dir() -> os.PathLike | str | None:
    candidates = []
    env_dir = os.environ.get("RAYZEK_STATIC_DIR")
    if env_dir:
        candidates.append(env_dir)
    here = os.path.dirname(os.path.abspath(__file__))
    candidates.append(os.path.join(here, "static"))
    candidates.append(os.path.abspath(os.path.join(here, "..", "..", "frontend", "dist")))
    for path in candidates:
        if path and os.path.isdir(path) and os.path.isfile(os.path.join(path, "index.html")):
            return path
    return None


_static_dir = _resolve_static_dir()

if _static_dir:
    from fastapi.staticfiles import StaticFiles

    logger.info("Serving bundled frontend from %s", _static_dir)
    # html=True makes it an SPA fallback (unknown paths -> index.html).
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="frontend")
else:

    @app.get("/")
    def root() -> dict:
        return {"name": "Rayzek", "version": __version__, "docs": "/docs"}
