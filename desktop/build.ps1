# Build rayzek.exe — a single, elevated Windows desktop app.
# Run from the repo root:  ./desktop/build.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> 1/5  Building frontend (production)" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
if (-not (Test-Path "node_modules")) { npm install }
npm run build
Pop-Location

Write-Host "==> 2/5  Preparing Python environment" -ForegroundColor Cyan
$py = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    python -m venv (Join-Path $root "backend\.venv")
}
& $py -m pip install --upgrade pip | Out-Null
& $py -m pip install -r (Join-Path $root "backend\requirements.txt")
& $py -m pip install -r (Join-Path $root "desktop\requirements-desktop.txt")

Write-Host "==> 3/5  Generating app icon" -ForegroundColor Cyan
& $py (Join-Path $root "desktop\make_icon.py")

Write-Host "==> 4/5  Running PyInstaller" -ForegroundColor Cyan
& $py -m PyInstaller --clean --noconfirm (Join-Path $root "desktop\rayzek.spec")

Write-Host "==> 5/5  Done" -ForegroundColor Green
$exe = Join-Path $root "dist\rayzek.exe"
if (Test-Path $exe) {
    Write-Host "Built: $exe" -ForegroundColor Green
    Write-Host "Size : $([math]::Round((Get-Item $exe).Length / 1MB, 1)) MB"
    Write-Host ""
    Write-Host "Run it (it will prompt for Administrator):  $exe" -ForegroundColor Yellow
    Write-Host "Enable auto-start at logon:  ./desktop/install-autostart.ps1" -ForegroundColor Yellow
} else {
    Write-Error "Build failed: rayzek.exe not found in dist/"
}
