"""Rayzek desktop application.

Packages the Rayzek backend (collector + API + WebSocket) and the built
frontend into a single native-window app:

* runs uvicorn on 127.0.0.1 in a background thread,
* serves the bundled SPA from the same origin (no browser, no URL bar),
* shows a system-tray icon and native Windows toast notifications for alerts,
* forces REAL data (demo mode off) and requests Administrator privileges via the
  PyInstaller UAC manifest so it can see every process's connections.

Data and logs live under %LOCALAPPDATA%\\Rayzek so they remain writable when the
process is elevated.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.request

# --------------------------------------------------------------------------- #
# Environment must be configured BEFORE importing the backend app, because
# settings are read (and cached) at import time.
# --------------------------------------------------------------------------- #
APP_DIR = os.path.join(
    os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "Rayzek"
)
os.makedirs(APP_DIR, exist_ok=True)

_db_path = os.path.join(APP_DIR, "rayzek.db").replace("\\", "/")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_db_path}")
os.environ["RAYZEK_DEMO_MODE"] = "false"  # never demo in the packaged app
os.environ.setdefault("GEOLOCATION_ENABLED", "true")
os.environ.setdefault("HOSTNAME_RESOLUTION_ENABLED", "true")
os.environ.setdefault("START_COLLECTOR_AUTOMATICALLY", "true")
os.environ.setdefault("LOG_LEVEL", "INFO")
os.environ.setdefault("APP_HOST", "127.0.0.1")
os.environ.setdefault("APP_PORT", "8000")

# Locate the bundled frontend when frozen by PyInstaller.
if getattr(sys, "frozen", False):
    _bundle = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    _static = os.path.join(_bundle, "frontend_dist")
    if os.path.isdir(_static):
        os.environ["RAYZEK_STATIC_DIR"] = _static

HOST = os.environ["APP_HOST"]
PORT = int(os.environ["APP_PORT"])
BASE_URL = f"http://{HOST}:{PORT}"

# Make the bundled backend package importable both frozen and from source.
if not getattr(sys, "frozen", False):
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

TASK_NAME = "RayzekAutostart"


# --------------------------------------------------------------------------- #
# Backend server
# --------------------------------------------------------------------------- #
def run_server() -> None:
    import uvicorn

    from app.main import app

    config = uvicorn.Config(app, host=HOST, port=PORT, log_level=os.environ["LOG_LEVEL"].lower())
    server = uvicorn.Server(config)
    server.run()


def wait_for_server(timeout: float = 30.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.4)
    return False


def port_in_use() -> bool:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((HOST, PORT)) == 0


# --------------------------------------------------------------------------- #
# Autostart via Task Scheduler (runs elevated at logon, no UAC prompt each boot)
# --------------------------------------------------------------------------- #
def _run_quiet(args: list[str]) -> int:
    import subprocess

    flags = 0x08000000 if os.name == "nt" else 0  # CREATE_NO_WINDOW
    return subprocess.run(
        args, capture_output=True, creationflags=flags
    ).returncode


def autostart_enabled() -> bool:
    return _run_quiet(["schtasks", "/Query", "/TN", TASK_NAME]) == 0


def enable_autostart() -> bool:
    exe = sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)
    return (
        _run_quiet(
            [
                "schtasks", "/Create", "/TN", TASK_NAME,
                "/TR", f'"{exe}"',
                "/SC", "ONLOGON",
                "/RL", "HIGHEST",  # run with highest privileges (elevated)
                "/F",
            ]
        )
        == 0
    )


def disable_autostart() -> bool:
    return _run_quiet(["schtasks", "/Delete", "/TN", TASK_NAME, "/F"]) == 0


# --------------------------------------------------------------------------- #
# Tray icon + toast notifications
# --------------------------------------------------------------------------- #
def make_icon_image():
    from PIL import Image, ImageDraw

    size = 64
    img = Image.new("RGBA", (size, size), (9, 11, 16, 255))
    d = ImageDraw.Draw(img)
    d.ellipse((8, 8, 56, 56), outline=(245, 166, 35, 255), width=3)
    d.ellipse((22, 22, 42, 42), outline=(78, 161, 255, 255), width=3)
    d.ellipse((28, 28, 36, 36), fill=(245, 166, 35, 255))
    return img


class AlertNotifier(threading.Thread):
    """Polls for new unacknowledged alerts and raises tray notifications."""

    def __init__(self, icon, stop_event: threading.Event) -> None:
        super().__init__(daemon=True)
        self._icon = icon
        self._stop = stop_event
        self._seen: set[int] = set()
        self._primed = False

    def run(self) -> None:
        while not self._stop.is_set():
            try:
                with urllib.request.urlopen(
                    f"{BASE_URL}/api/alerts?acknowledged=false&limit=20", timeout=4
                ) as resp:
                    alerts = json.loads(resp.read().decode("utf-8"))
                new = [a for a in alerts if a["id"] not in self._seen]
                for a in alerts:
                    self._seen.add(a["id"])
                # Only notify for higher-severity findings, and never burst a
                # backlog of pre-existing alerts on startup.
                if self._primed:
                    notable = [a for a in new if a.get("severity") in ("medium", "high")]
                    for a in notable[:2]:
                        self._notify(a)
                self._primed = True
            except Exception:
                pass
            self._stop.wait(8.0)

    def _notify(self, alert: dict) -> None:
        try:
            title = f"Rayzek · {alert.get('severity', 'alert').title()}"
            self._icon.notify(alert.get("title", "Unusual activity detected"), title)
        except Exception:
            pass


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> int:
    import webview

    server_thread: threading.Thread | None = None
    if not port_in_use():
        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        if not wait_for_server():
            # Surface a minimal error window rather than dying silently.
            webview.create_window(
                "Rayzek — startup error",
                html="<body style='background:#090B10;color:#e9ecf2;font-family:sans-serif;"
                "padding:40px'><h2>Rayzek failed to start its local service.</h2>"
                "<p>Check %LOCALAPPDATA%\\Rayzek for logs.</p></body>",
            )
            webview.start()
            return 1

    # Tray icon (best-effort; the app still works without it).
    stop_event = threading.Event()
    tray_icon = None
    try:
        import pystray

        def _open(icon, _item):
            try:
                webview.windows[0].show()
            except Exception:
                pass

        def _toggle_autostart(icon, _item):
            if autostart_enabled():
                disable_autostart()
            else:
                enable_autostart()
            icon.update_menu()

        def _quit(icon, _item):
            stop_event.set()
            icon.stop()
            for w in list(webview.windows):
                try:
                    w.destroy()
                except Exception:
                    pass

        menu = pystray.Menu(
            pystray.MenuItem("Open Rayzek", _open, default=True),
            pystray.MenuItem(
                "Start with Windows",
                _toggle_autostart,
                checked=lambda _i: autostart_enabled(),
            ),
            pystray.MenuItem("Quit", _quit),
        )
        tray_icon = pystray.Icon("rayzek", make_icon_image(), "Rayzek", menu)
        tray_icon.run_detached()
        AlertNotifier(tray_icon, stop_event).start()
    except Exception:
        tray_icon = None

    window = webview.create_window(
        "RAYZEK — See where your computer is talking",
        BASE_URL,
        width=1440,
        height=920,
        min_size=(1024, 700),
        background_color="#090B10",
    )

    def _on_closed() -> None:
        stop_event.set()
        if tray_icon is not None:
            try:
                tray_icon.stop()
            except Exception:
                pass

    window.events.closed += _on_closed
    webview.start()
    return 0


if __name__ == "__main__":
    sys.exit(main())
