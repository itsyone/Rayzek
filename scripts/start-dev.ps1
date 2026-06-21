# Rayzek — start backend and frontend in development mode (Windows / PowerShell).
# Usage:  .\scripts\start-dev.ps1  [-Demo]
param(
    [switch]$Demo
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Starting Rayzek (dev)..." -ForegroundColor Cyan

# --- Backend ---
$backend = Join-Path $root "backend"
$venvPython = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating backend virtual environment..." -ForegroundColor Yellow
    python -m venv (Join-Path $backend ".venv")
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r (Join-Path $backend "requirements.txt")
}

$env:RAYZEK_DEMO_MODE = if ($Demo) { "true" } else { "false" }

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$backend'; `$env:RAYZEK_DEMO_MODE='$($env:RAYZEK_DEMO_MODE)'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
)

# --- Frontend ---
$frontend = Join-Path $root "frontend"
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location $frontend; npm install; Pop-Location
}
Start-Process powershell -ArgumentList @("-NoExit", "-Command", "cd '$frontend'; npm run dev")

Write-Host "Backend:  http://127.0.0.1:8000  (docs at /docs)" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
