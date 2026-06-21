# Build the Rayzek Windows installer (rayzek-setup.exe).
# Requires Inno Setup 6 (https://jrsoftware.org/isdl.php).
#   winget install -e --id JRSoftware.InnoSetup
#
# Usage:  ./desktop/build-installer.ps1   (builds rayzek.exe first if missing)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$iss = Join-Path $root "desktop\installer\rayzek.iss"
$exe = Join-Path $root "dist\rayzek.exe"

if (-not (Test-Path $exe)) {
    Write-Host "rayzek.exe not found — building it first..." -ForegroundColor Yellow
    & (Join-Path $root "desktop\build.ps1")
}

# Locate the Inno Setup command-line compiler.
$iscc = $null
$candidates = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
)
foreach ($c in $candidates) { if (Test-Path $c) { $iscc = $c; break } }
if (-not $iscc) {
    $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($cmd) { $iscc = $cmd.Source }
}

if (-not $iscc) {
    Write-Error @"
Inno Setup compiler (ISCC.exe) not found.
Install it, then re-run this script:
    winget install -e --id JRSoftware.InnoSetup
"@
    exit 1
}

Write-Host "Compiling installer with $iscc" -ForegroundColor Cyan
& $iscc $iss

$out = Join-Path $root "desktop\installer\Output\rayzek-setup.exe"
if (Test-Path $out) {
    Write-Host "Built installer: $out" -ForegroundColor Green
    Write-Host "Size: $([math]::Round((Get-Item $out).Length / 1MB, 1)) MB"
} else {
    Write-Error "Installer build failed."
}
