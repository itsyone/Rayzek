# Rayzek

*See where your computer is talking.*

[![Download](https://img.shields.io/github/v/release/itsyone/Rayzek?label=download&color=f5a623)](https://github.com/itsyone/Rayzek/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-46c88c)](LICENSE)

Rayzek watches the network connections that apps on your own PC are making and shows them
in real time — which program, where it's connecting in the world, on what port, and whether
anything looks off. It's basically a friendlier, visual version of staring at `netstat`, with a
world map and a live feed instead of a wall of text.

I built it because I wanted to actually *see* what was phoning home in the background without
running Wireshark and drowning in packets. So a few ground rules: Rayzek only looks at your own
machine, it never touches packet contents, it doesn't block anything, and it doesn't send your
data anywhere except (optionally) looking up the country for a public IP. That's it.

## Download

**[Grab the latest installer →](https://github.com/itsyone/Rayzek/releases/latest)** (`rayzek-setup.exe`, Windows 10/11)

1. Run `rayzek-setup.exe`. It's not code-signed, so SmartScreen will probably moan — hit
   *More info → Run anyway*.
2. Go through the wizard (it can add a desktop shortcut and start with Windows if you want).
3. Open Rayzek from the Start menu. It asks for admin rights — say yes. Without them Windows only
   lets it see *your* user's connections; with them you see everything on the box.

It runs in its own window (no browser, no localhost tab to keep open) and everything stays on your
machine in `%LOCALAPPDATA%\Rayzek`. To remove it, just uninstall from *Settings → Apps* like
anything else.

Don't want to install? The release also has a standalone `rayzek.exe` you can run directly.

## What you get

- A dark world map with arcs from your location out to wherever your apps are connecting.
  Bigger dots = contacted more often, colour = how sketchy it looks.
- A live feed of connections opening and closing, plus a sortable table you can filter and search.
- Per-app and per-destination breakdowns — what `chrome.exe` is talking to, who's behind
  `142.250.x.x`, which countries showed up, etc.
- Reverse-DNS + country/city/org lookups for public IPs (private/LAN addresses are never sent
  anywhere).
- Alerts when something's worth a second look — a process suddenly hitting a new country, a burst
  of connections, a connection to an unusual port. They're deliberately conservative and every
  alert tells you exactly *why* it fired. Nothing gets blocked automatically and nothing is labelled
  "malware" — it's "hey, maybe look at this."
- CSV export and a history view with a playback mode if you want to scrub back through the day.

There's also a **demo mode** that makes up realistic-looking traffic so you can poke around the UI
without it reading anything real.

## A quick honesty section

- This is a defensive/visibility tool. It does **not** scan other machines, capture passwords or
  page contents, crack TLS, or interfere with traffic.
- Geolocation is only as good as the free IP database behind it — treat city/org as a rough hint.
- On a VPN, the "you are here" dot reflects whatever your exit node looks like, not your house. You
  can set your own approximate origin in Settings.
- The alert rules are heuristics. A flagged connection is a prompt to look, not a verdict.

## Running from source

You'll need Python 3.11+ and Node 18+. Backend:

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# Linux/mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # copy on Windows
uvicorn app.main:app --reload
```

That brings the API up on `http://127.0.0.1:8000` (docs at `/docs`). Frontend in another terminal:

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Or just run `scripts/start-dev.ps1` (Windows) / `scripts/start-dev.sh` (Linux/mac) to launch both.
Add `-Demo` / `--demo` for demo mode.

To rebuild the Windows app and installer yourself:

```powershell
./desktop/build.ps1                            # -> dist/rayzek.exe
winget install -e --id JRSoftware.InnoSetup    # one-time
./desktop/build-installer.ps1                  # -> rayzek-setup.exe
```

Config lives in `backend/.env` — see `backend/.env.example` for every knob (poll interval, whether
geolocation is on, map style, retention, etc.). It all works fine with the defaults and no API key.

## How it's put together

The backend is FastAPI. A background loop polls `psutil` once a second, figures out which
connections are new/changed/gone, stores them in SQLite, looks up geo/DNS for new public IPs in the
background, runs the alert rules, and pushes everything to the frontend over a WebSocket. The
frontend is React + TypeScript (Vite, Tailwind, MapLibre for the map, Recharts for the charts,
Zustand + TanStack Query for state).

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and the privacy specifics are in
[docs/PRIVACY.md](docs/PRIVACY.md).

## Platforms

Built and tested on Windows 10/11 (that's where the installer is for). The backend and frontend
also run on Linux — on Linux you'll want `sudo` for system-wide visibility, same idea as admin on
Windows. It starts fine without elevated rights, you just see less.

## License

MIT — do what you want with it. See [LICENSE](LICENSE).
