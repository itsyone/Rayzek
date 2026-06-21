# Remove Rayzek's logon auto-start task. Run from an elevated PowerShell.
$ErrorActionPreference = "SilentlyContinue"
Unregister-ScheduledTask -TaskName "RayzekAutostart" -Confirm:$false
Write-Host "Rayzek auto-start removed." -ForegroundColor Green
