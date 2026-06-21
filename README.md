# RAYZEK

**See where your computer is talking.**

[![Download](https://img.shields.io/github/v/release/itsyone/Rayzek?label=Download&color=f5a623)](https://github.com/itsyone/Rayzek/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-4ea1ff)](#-download--install-windows)
[![License](https://img.shields.io/badge/license-MIT-46c88c)](LICENSE)

Rayzek is a defensive cybersecurity and network-visibility desktop dashboard. It shows, in near
real time, the active network connections made by applications running on **your own computer** —
which process, where it is connecting, and whether anything looks unusual — visualised on an
interactive world map and a live event stream.

Rayzek is **defensive only**. It monitors the local machine. It does **not** scan other hosts,
capture credentials, modify packets, decrypt traffic, or block connections.

---

## ⬇️ Download & Install (Windows)

> **[Download the latest installer → `rayzek-setup.exe`](https://github.com/itsyone/Rayzek/releases/latest/download/rayzek-setup.exe)**
> (from the [Releases page](https://github.com/itsyone/Rayzek/releases/latest))

1. **Run `rayzek-setup.exe`.** Windows SmartScreen may warn (the app is unsigned) —
   click **More info → Run anyway**.
2. Follow the wizard. It installs to *Program Files*, adds **Start Menu** and (optionally)
   **Desktop** shortcuts, and can **start Rayzek automatically when you log in**.
3. Launch **Rayzek** from the Start Menu. It will prompt for **Administrator** — this is required
   to see *every* application's connections (without it you only see your own user's).

That's it. Rayzek runs as a single native desktop window — no browser, no setup, real live data.

- **Uninstall:** *Settings → Apps → Rayzek → Uninstall* (or via Add/Remove Programs).
- **Data location:** everything stays local in `%LOCALAPPDATA%\Rayzek`.
- Prefer not to install? A portable `rayzek.exe` works too — see
  [Desktop app](#desktop-app--rayzekexe-windows) below.

> Building from source instead? Jump to [Installation](#installation).

---

## Screenshots

> _Add screenshots to `docs/screenshots/` and reference them here._

| Overview | Live Map | Connections |
| --- | --- | --- |
| _overview.png_ | _map.png_ | _connections.png_ |

---

## Features

- **Live connection monitoring** via `psutil` — process name, PID, executable, user, local/remote
  address and port, protocol, and TCP state.
- **Interactive world map** (MapLibre GL) with animated arcs from your approximate location to remote
  destinations; markers sized by observation count and coloured by risk.
- **Destination enrichment** — reverse DNS, country, city, organization/ASN, with private-IP guards,
  caching, rate limiting, and a key-free default provider.
- **Explainable, rule-based alerts** with machine-readable evidence (new country, new destination,
  connection burst, many countries, uncommon port, repeated failures, unknown executable).
- **Conservative 0–100 risk scoring** (Low / Review / Elevated / High).
- **Real-time WebSocket stream** with automatic reconnection and a visible Live / Reconnecting /
  Offline indicator.
- **Full REST API** with filtering, sorting, pagination, and CSV export.
- **History & playback** — charts over time and a replay of past connection events on the map.
- **Demo mode** — realistic synthetic data, no real connections read.
- **Privacy-first** — binds to `127.0.0.1`, strict CORS, no payload capture, geolocation and
  hostname resolution can be disabled.

---

## Technology stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Framer Motion, MapLibre GL JS, Recharts,
Lucide, Zustand, TanStack Query, React Router.

**Backend:** Python 3.11+, FastAPI, WebSockets, psutil, SQLAlchemy, SQLite, Pydantic, Uvicorn,
httpx, python-dotenv.

**Testing/quality:** Pytest, Vitest, React Testing Library, Ruff, ESLint, Prettier, TypeScript
strict mode.

---

## Architecture overview

```
┌────────────────────────── Backend (FastAPI, 127.0.0.1:8000) ──────────────────────────┐
│  Collector loop ──poll──▶ Connection source (psutil | demo)                            │
│        │  diff in-memory state (first/last seen, observation count, active)            │
│        ├─▶ SQLite (processes, destinations, connections, alerts, settings)             │
│        ├─▶ Enrichment service (reverse DNS + geo provider, cached, private-IP guarded) │
│        ├─▶ Alert engine (7 explainable rules, evidence, dedupe)                        │
│        └─▶ WebSocket hub ──broadcast──▶ /ws/live                                       │
│  REST API: /api/health /api/stats /api/connections /api/processes /api/destinations    │
│            /api/alerts /api/collector /api/settings /api/history /api/export            │
└────────────────────────────────────────────────────────────────────────────────────────┘
        ▲ REST (TanStack Query)            ▲ WS (auto-reconnect)
┌────────────────────────── Frontend (Vite/React, localhost:5173) ─────────────────────────┐
│  Stores (Zustand): app state, live events + map markers, toasts                           │
│  Pages: Overview · Map · Connections · Processes · Destinations · Alerts · History ·      │
│         Settings                                                                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detail.

---

## Installation

Requires **Python 3.11+** and **Node.js 18+**.

### Backend

```bash
cd backend
python -m venv .venv
```

**Windows (PowerShell):**

```powershell
.venv\Scripts\activate
```

**Linux / macOS:**

```bash
source .venv/bin/activate
```

Then:

```bash
pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env
uvicorn app.main:app --reload
```

Backend runs at `http://127.0.0.1:8000` (interactive API docs at `/docs`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api` and `/ws` to the backend.

### Desktop app — `rayzek.exe` (Windows)

Package everything (backend + collector + built frontend) into a single native-window
executable. No browser, no URL bar — a real desktop app that shows **live, real** connection
data and Windows toast notifications when alerts fire.

```powershell
./desktop/build.ps1            # produces dist/rayzek.exe (~35 MB)
```

Then:

```powershell
dist\rayzek.exe                       # launches; prompts for Administrator (for full visibility)
./desktop/install-autostart.ps1       # start automatically at logon (elevated, run from admin PowerShell)
./desktop/uninstall-autostart.ps1     # remove auto-start
```

#### Installer (recommended for everyday use)

Instead of running the portable exe, build a real installer that adds Rayzek to
Program Files with Start Menu + Desktop shortcuts and an Add/Remove Programs
entry (optionally starting at logon):

```powershell
winget install -e --id JRSoftware.InnoSetup   # one-time: the installer compiler
./desktop/build-installer.ps1                  # -> desktop/installer/Output/rayzek-setup.exe
```

Run `rayzek-setup.exe` to install. Uninstall from **Settings → Apps** like any
other program.

- Runs the API + collector on `127.0.0.1:8000` and serves the UI from the same origin.
- Forces **real mode** (demo off) and **geolocation on**; data/logs live in `%LOCALAPPDATA%\Rayzek`.
- Requests **Administrator** via an embedded UAC manifest so the collector can read every
  process's connections.
- System-tray icon with **Open**, **Start with Windows**, and **Quit**; toast notifications for new
  alerts.

> Requires the Microsoft Edge **WebView2 Runtime** (preinstalled on current Windows 10/11). The exe
> is unsigned, so SmartScreen may warn on first run — choose _More info → Run anyway_, or sign it
> with your own certificate.

### One-shot dev launchers

```powershell
# Windows
./scripts/start-dev.ps1            # real data
./scripts/demo.ps1                 # demo mode
```

```bash
# Linux / macOS
./scripts/start-dev.sh             # real data
./scripts/demo.sh                  # demo mode
```

---

## Environment configuration

Copy `backend/.env.example` to `backend/.env` and adjust. Key variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_HOST` / `APP_PORT` | `127.0.0.1` / `8000` | Bind address (localhost only by default) |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `CONNECTION_POLL_INTERVAL` | `1.0` | Collector poll interval (seconds) |
| `GEOLOCATION_ENABLED` | `true` | Send public IPs to the geo provider |
| `GEO_PROVIDER_URL` | ip-api.com (key-free) | `{ip}` / `{key}` templated URL |
| `HOSTNAME_RESOLUTION_ENABLED` | `true` | Reverse DNS lookups |
| `ORIGIN_LATITUDE` / `ORIGIN_LONGITUDE` | San Francisco | Approximate map origin |
| `MAP_STYLE_URL` | CARTO dark-matter | Any MapLibre style URL |
| `RAYZEK_DEMO_MODE` | `false` | Synthetic data, no real connections |
| `TSHARK_ENABLED` | `false` | Experimental packet capture (off by default) |
| `RETENTION_DAYS` | `30` | History retention (0 = keep forever) |

The app is fully usable **without** any external API key.

---

## Permission requirements

Rayzek **starts and runs without elevated privileges** and shows whatever information is available.
Some per-process details (executable path, owning user, and connections owned by other users)
require elevation:

- **Windows:** run the backend terminal **as Administrator** for full visibility.
- **Linux (Ubuntu, Parrot OS, …):** run the backend with `sudo` for system-wide process/socket
  details. Without it, you still see your own user's connections.

When privileges are limited, a banner appears and affected fields read _“Unresolved”_.

---

## Demo mode

Demo mode generates realistic synthetic connections (chrome, discord, spotify, steam, code, and an
occasional `unknown.exe` burst) across multiple countries, **without reading your real network
state**. A **Demo Mode** badge is shown in the top bar.

```bash
RAYZEK_DEMO_MODE=true uvicorn app.main:app --reload   # or use scripts/demo.*
```

---

## Frontend commands

```bash
npm run dev       # start dev server
npm run build     # typecheck + production build
npm run test      # Vitest
npm run lint      # ESLint
npm run format    # Prettier
```

## Backend commands

```bash
uvicorn app.main:app --reload   # run API + collector
pytest -q                       # tests
ruff check app tests            # lint
```

---

## Troubleshooting

- **Frontend shows “Backend is offline.”** Ensure `uvicorn app.main:app` is running on port 8000.
- **No connections appear (real mode).** Open an app that uses the internet, or run with elevated
  privileges. Try demo mode to confirm the UI works.
- **Countries are empty.** Geolocation may be disabled, or the provider is unreachable. Public IPs
  still appear; enable `GEOLOCATION_ENABLED` and check `GEO_PROVIDER_URL`.
- **Map is blank.** Verify `MAP_STYLE_URL` is reachable; you can point it at any MapLibre style.
- **Database looks stale.** Run `scripts/reset-db.sh` / `scripts/reset-db.ps1`.

---

## Privacy statement

Rayzek processes data **locally**. It stores process names, connection metadata, and **public**
destination IPs in a local SQLite file. It does **not** collect passwords, cookies, message or page
contents, form data, packet payloads, or credentials, and it does **not** send your process list or
connection history to any third-party analytics service. Only public destination IP addresses are
sent to the configured geolocation provider, and only when geolocation is enabled. See
[docs/PRIVACY.md](docs/PRIVACY.md).

## Security limitations

- Visibility depends on OS privileges; without elevation some processes/sockets are hidden.
- Geolocation accuracy depends on the third-party provider and is approximate.
- Alerts are **heuristic and conservative**. An alert means _“review recommended,”_ **not** that an
  application is malware. Rayzek never blocks connections.
- The optional TShark mode is experimental, disabled by default, captures **only this machine's**
  traffic, and may require administrator/root privileges.

---

## Roadmap

- Per-process network rate/throughput (where the OS exposes it without payload capture).
- Optional TShark metadata enrichment (counts/timings only, no payloads).
- Saved filter views and notification integrations.
- Packaged desktop builds.

## Contribution guide

1. Fork and branch from `main`.
2. Keep modules small and typed; run `scripts/format.sh` and the test suites before opening a PR.
3. Do not add offensive capabilities, payload capture, automatic blocking, or third-party telemetry.

## License

MIT — see [LICENSE](LICENSE).
