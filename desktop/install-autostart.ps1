# Register Rayzek to start automatically at logon, elevated (no UAC prompt each
# boot). Must be run from an elevated PowerShell.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "dist\rayzek.exe"

if (-not (Test-Path $exe)) {
    Write-Error "rayzek.exe not found. Build it first with ./desktop/build.ps1"
    exit 1
}

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive -RunLevel Highest
$action = New-ScheduledTaskAction -Execute $exe
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "RayzekAutostart" -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Rayzek will now start automatically at logon (elevated)." -ForegroundColor Green
Write-Host "Remove it any time with ./desktop/uninstall-autostart.ps1" -ForegroundColor Yellow
