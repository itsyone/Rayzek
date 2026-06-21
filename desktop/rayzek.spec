# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec: build a single, elevated rayzek.exe.

Bundles the FastAPI backend (app package), the uvicorn server, and the built
frontend (frontend/dist -> frontend_dist). Requests Administrator via uac_admin
so the collector can read every process's connections.
"""

import os
from PyInstaller.utils.hooks import collect_submodules, collect_all

ROOT = os.path.abspath(os.getcwd())
BACKEND = os.path.join(ROOT, "backend")
FRONTEND_DIST = os.path.join(ROOT, "frontend", "dist")
ICON = os.path.join(ROOT, "desktop", "rayzek.ico")

hiddenimports = []
hiddenimports += collect_submodules("uvicorn")
hiddenimports += collect_submodules("websockets")
hiddenimports += collect_submodules("app")  # the Rayzek backend package
hiddenimports += ["psutil", "anyio", "sqlalchemy.dialects.sqlite"]

datas = []
binaries = []
for pkg in ("webview", "pystray", "PIL"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# Ship the built SPA.
if os.path.isdir(FRONTEND_DIST):
    datas.append((FRONTEND_DIST, "frontend_dist"))

a = Analysis(
    [os.path.join(ROOT, "desktop", "rayzek_app.py")],
    pathex=[BACKEND, ROOT],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "pytest", "ruff"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="rayzek",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=False,            # no console window
    uac_admin=True,           # request Administrator (full connection visibility)
    icon=ICON if os.path.isfile(ICON) else None,
)
