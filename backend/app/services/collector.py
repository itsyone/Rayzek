"""Background connection collector and live-event orchestrator.

Runs an asyncio loop that polls a connection source, diffs against in-memory
state, persists changes to SQLite, schedules destination enrichment, evaluates
alert rules, and broadcasts structured events over the WebSocket hub.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.collectors.base import ConnectionSource, RawConnection
from app.collectors.demo_source import DemoConnectionSource
from app.collectors.system_source import SystemConnectionSource
from app.core.config import Settings
from app.core.logging_config import get_logger
from app.database.session import SessionLocal
from app.services import store
from app.services.alerts import AlertEngine, draft_to_model
from app.services.enrichment import EnrichmentService
from app.services.risk import quick_score
from app.utils.netutils import ConnectionIdentity, classify_ip
from app.websocket.hub import hub

logger = get_logger("rayzek.collector")


@dataclass
class _LiveState:
    connection_id: int
    last_status: str
    last_seen: datetime
    observation_count: int = 1
    enriched: bool = False


@dataclass
class CollectorState:
    running: bool = False
    demo_mode: bool = False
    permission_limited: bool = False
    last_poll: datetime | None = None
    poll_interval: float = 1.0
    source_name: str = "psutil"
    live: dict[str, _LiveState] = field(default_factory=dict)


class CollectorService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._enrichment = EnrichmentService(settings)
        self._alerts = AlertEngine()
        self._state = CollectorState(
            poll_interval=settings.connection_poll_interval,
            demo_mode=settings.rayzek_demo_mode,
        )
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        self._source: ConnectionSource = self._build_source()
        self._state.source_name = self._source.name

    # ------------------------------------------------------------------ #
    def _build_source(self) -> ConnectionSource:
        if self._settings.rayzek_demo_mode:
            logger.info("Collector running in DEMO mode (synthetic data).")
            return DemoConnectionSource()
        return SystemConnectionSource()

    @property
    def state(self) -> CollectorState:
        return self._state

    @property
    def alert_engine(self) -> AlertEngine:
        return self._alerts

    @property
    def enrichment(self) -> EnrichmentService:
        return self._enrichment

    # ------------------------------------------------------------------ #
    async def start(self) -> None:
        if self._state.running:
            return
        self._stop_event.clear()
        self._state.running = True
        self._task = asyncio.create_task(self._run(), name="rayzek-collector")
        logger.info("Collector started (interval=%.2fs)", self._state.poll_interval)
        await self._broadcast_status()

    async def stop(self) -> None:
        if not self._state.running:
            return
        self._stop_event.set()
        self._state.running = False
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5.0)
            except TimeoutError:
                self._task.cancel()
        logger.info("Collector stopped.")
        await self._broadcast_status()

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self._tick()
            except Exception as exc:  # the loop must never die
                logger.exception("Collector tick failed: %s", exc)
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(), timeout=self._state.poll_interval
                )
            except TimeoutError:
                pass

    # ------------------------------------------------------------------ #
    async def _tick(self) -> None:
        raws, permission_limited = await asyncio.to_thread(self._source.poll)
        self._state.permission_limited = permission_limited
        self._state.last_poll = datetime.now(UTC)

        current_keys: set[str] = set()
        session = SessionLocal()
        enrich_targets: list[str] = []
        try:
            for raw in raws:
                if raw.pid is None:
                    continue
                identity = ConnectionIdentity(
                    pid=raw.pid,
                    local_ip=raw.local_ip,
                    local_port=raw.local_port,
                    remote_ip=raw.remote_ip,
                    remote_port=raw.remote_port,
                    protocol=raw.protocol,
                )
                key = identity.key()
                current_keys.add(key)
                existing = self._state.live.get(key)
                if existing is None:
                    await self._handle_new(session, raw, key, enrich_targets)
                else:
                    self._handle_update(session, raw, existing)
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

        # Detect closed connections.
        closed = set(self._state.live.keys()) - current_keys
        if closed:
            await self._handle_closed(closed)

        # Kick off enrichment for newly seen public destinations.
        for ip in enrich_targets:
            asyncio.create_task(self._enrich_and_broadcast(ip))

    # ------------------------------------------------------------------ #
    async def _handle_new(
        self,
        session,
        raw: RawConnection,
        key: str,
        enrich_targets: list[str],
    ) -> None:
        proc = store.upsert_process(
            session, pid=raw.pid, name=raw.process_name,
            exe=raw.executable_path, username=raw.username,
        )
        is_new_dest = store.is_new_destination_for_process(session, proc.id, raw.remote_ip)
        dest = store.upsert_destination(session, raw.remote_ip)
        is_private = classify_ip(raw.remote_ip) != "public"
        score = quick_score(raw.remote_port, is_private, raw.status)

        record = store.get_connection(
            session,
            process_id=proc.id,
            local_port=raw.local_port,
            remote_ip=raw.remote_ip,
            remote_port=raw.remote_port,
            protocol=raw.protocol,
        )
        now = datetime.now(UTC)
        if record is None:
            from app.models import ConnectionRecord

            record = ConnectionRecord(
                process_id=proc.id,
                destination_id=dest.id if dest else None,
                local_ip=raw.local_ip,
                local_port=raw.local_port,
                remote_ip=raw.remote_ip,
                remote_port=raw.remote_port,
                protocol=raw.protocol,
                connection_status=raw.status,
                first_seen=now,
                last_seen=now,
                observation_count=1,
                is_active=True,
                risk_score=score,
            )
            session.add(record)
            session.flush()
        else:
            record.is_active = True
            record.last_seen = now
            record.observation_count += 1
            record.connection_status = raw.status
            record.risk_score = max(record.risk_score, score)

        self._state.live[key] = _LiveState(
            connection_id=record.id,
            last_status=raw.status,
            last_seen=now,
            observation_count=record.observation_count,
            enriched=bool(dest and dest.enriched),
        )

        if raw.remote_ip and not is_private and (dest is None or not dest.enriched):
            if raw.remote_ip not in enrich_targets:
                enrich_targets.append(raw.remote_ip)

        await hub.broadcast(
            "connection_opened",
            self._conn_payload(record, raw, dest, proc, is_new_dest),
        )

        # Evaluate alert rules.
        await self._evaluate_alerts(
            session, raw, dest, is_new_connection=True
        )

    def _handle_update(self, session, raw: RawConnection, live: _LiveState) -> None:
        from app.models import ConnectionRecord

        now = datetime.now(UTC)
        live.last_seen = now
        live.observation_count += 1
        status_changed = live.last_status != raw.status
        live.last_status = raw.status

        record = session.get(ConnectionRecord, live.connection_id)
        if record is not None:
            record.last_seen = now
            record.observation_count += 1
            record.connection_status = raw.status
            record.is_active = True

        if status_changed:
            hub.broadcast_threadsafe(
                "connection_updated",
                {
                    "connection_id": live.connection_id,
                    "status": raw.status,
                    "process_name": raw.process_name,
                    "remote_ip": raw.remote_ip,
                    "observation_count": live.observation_count,
                },
            )

    async def _handle_closed(self, closed_keys: set[str]) -> None:
        from app.models import ConnectionRecord

        session = SessionLocal()
        try:
            for key in closed_keys:
                live = self._state.live.pop(key, None)
                if live is None:
                    continue
                record = session.get(ConnectionRecord, live.connection_id)
                if record is not None:
                    record.is_active = False
                    await hub.broadcast(
                        "connection_closed",
                        {
                            "connection_id": record.id,
                            "process_name": record.process.process_name
                            if record.process
                            else None,
                            "remote_ip": record.remote_ip,
                        },
                    )
            session.commit()
        except Exception:
            session.rollback()
        finally:
            session.close()

    # ------------------------------------------------------------------ #
    async def _enrich_and_broadcast(self, ip: str) -> None:
        try:
            geo = await self._enrichment.enrich(ip)
        except Exception as exc:
            logger.warning("Enrichment failed for %s: %s", ip, exc)
            return
        session = SessionLocal()
        try:
            dest = store.apply_enrichment(session, ip, geo)
            session.commit()
            if dest is not None:
                await hub.broadcast(
                    "destination_enriched",
                    {
                        "ip_address": dest.ip_address,
                        "hostname": dest.hostname,
                        "country_code": dest.country_code,
                        "country_name": dest.country_name,
                        "city": dest.city,
                        "latitude": dest.latitude,
                        "longitude": dest.longitude,
                        "organization": dest.organization,
                        "asn": dest.asn,
                    },
                )
        except Exception:
            session.rollback()
        finally:
            session.close()

    async def _evaluate_alerts(
        self, session, raw: RawConnection, dest, *, is_new_connection: bool
    ) -> None:
        drafts = self._alerts.evaluate(
            process_name=raw.process_name,
            executable_path=raw.executable_path,
            remote_ip=raw.remote_ip,
            remote_port=raw.remote_port,
            country_code=dest.country_code if dest else None,
            country_name=dest.country_name if dest else None,
            status=raw.status,
            is_new_connection=is_new_connection,
        )
        for draft in drafts:
            alert = draft_to_model(draft)
            session.add(alert)
            session.flush()
            await hub.broadcast(
                "alert_created",
                {
                    "id": alert.id,
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "title": alert.title,
                    "description": alert.description,
                    "process_name": alert.process_name,
                    "remote_ip": alert.remote_ip,
                    "destination_country": alert.destination_country,
                    "evidence": draft.evidence,
                    "created_at": alert.created_at.isoformat()
                    if alert.created_at
                    else datetime.now(UTC).isoformat(),
                },
            )

    # ------------------------------------------------------------------ #
    def _conn_payload(self, record, raw: RawConnection, dest, proc, is_new_dest: bool) -> dict:
        return {
            "connection_id": record.id,
            "process_name": raw.process_name,
            "pid": raw.pid,
            "local_ip": raw.local_ip,
            "local_port": raw.local_port,
            "remote_ip": raw.remote_ip,
            "remote_port": raw.remote_port,
            "protocol": raw.protocol,
            "status": raw.status,
            "hostname": dest.hostname if dest else None,
            "country_code": dest.country_code if dest else None,
            "country_name": dest.country_name if dest else None,
            "latitude": dest.latitude if dest else None,
            "longitude": dest.longitude if dest else None,
            "organization": dest.organization if dest else None,
            "first_seen": record.first_seen.isoformat(),
            "is_new_destination": is_new_dest,
            "risk_score": record.risk_score,
        }

    async def _broadcast_status(self) -> None:
        await hub.broadcast(
            "collector_status",
            {
                "running": self._state.running,
                "demo_mode": self._state.demo_mode,
                "permission_limited": self._state.permission_limited,
                "poll_interval": self._state.poll_interval,
                "source": self._state.source_name,
            },
        )

    def set_poll_interval(self, interval: float) -> None:
        self._state.poll_interval = max(0.25, min(60.0, interval))
