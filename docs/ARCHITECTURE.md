# Rayzek Architecture

## Overview

Rayzek is a local-only monorepo: a FastAPI backend that observes the machine's network connections
and a React frontend that visualises them. The backend binds to `127.0.0.1` and never exposes the
service publicly by default.

## Backend

```
backend/app/
├── core/          config (pydantic-settings), logging, runtime registry
├── database/      SQLAlchemy engine/session, init_db, WAL pragmas
├── models/        ProcessRecord, Destination, ConnectionRecord, Alert, ApplicationSetting
├── schemas/       Pydantic request/response models
├── collectors/    RawConnection source abstraction: system (psutil) + demo
├── services/      collector orchestrator, enrichment, geo provider, alerts, risk, store helpers
├── api/           REST routers (core, connections, processes, destinations, alerts, history, export)
├── websocket/     EventHub + /ws/live route
└── main.py        app assembly, lifespan (init db, retention, start collector)
```

### Collector loop

1. Poll the active connection source (`psutil.net_connections(kind="inet")` or the demo source) in a
   worker thread so the event loop is never blocked.
2. Build a stable **connection identity** (`pid | local | remote | protocol`) and diff against the
   in-memory state to classify each observation as **opened**, **updated**, or **closed**.
3. Persist to SQLite — one row per logical entity, updating `first_seen` / `last_seen` /
   `observation_count` / `is_active` rather than inserting duplicates each second.
4. Schedule **enrichment** for newly seen public destinations (private/loopback/reserved IPs are
   never sent externally).
5. Evaluate **alert rules** and persist alerts with machine-readable evidence.
6. Broadcast structured events over the WebSocket hub.

All per-process and per-connection access is wrapped to tolerate `NoSuchProcess`, `AccessDenied`,
`ZombieProcess`, `PermissionError`, and `OSError`. The loop catches all exceptions so it never dies.

### Risk & alerts

Risk is a conservative 0–100 score (Low 0–24, Review 25–49, Elevated 50–74, High 75–100). Private
destinations are always 0. The seven alert rules are explainable and deduplicated within a cooldown.

## Frontend

```
frontend/src/
├── api/           fetch client + TanStack Query hooks
├── stores/        Zustand: app state, live events/markers, toasts
├── hooks/         useWebSocket (auto-reconnect), useDebounce
├── components/    ui primitives, layout, map, connections, alerts, dashboard, history
├── pages/         Overview, Map, Connections, Processes(+detail), Destinations(+detail),
│                  Alerts, History, Settings
└── utils/         formatting, risk, geo (arc geometry)
```

- A single global WebSocket connection feeds the event store; the map updates its GeoJSON sources
  imperatively (`setData`) so it is never re-created per event.
- TanStack Query handles REST state with light polling as a fallback to the live stream.
- Theme is tokenised via CSS variables consumed by Tailwind (`bg`, `panel`, `accent`, …).

## Data flow summary

`source → collector diff → SQLite + enrichment + alerts → WebSocket → Zustand → React views`,
with REST endpoints serving historical/aggregated queries and CSV exports.
