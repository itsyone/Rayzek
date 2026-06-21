# Remove the local SQLite database so it is recreated on next startup.
$backend = Join-Path (Split-Path -Parent $PSScriptRoot) "backend"
Get-ChildItem -Path $backend -Filter "rayzek.db*" -ErrorAction SilentlyContinue | Remove-Item -Force
Write-Host "Database reset. It will be recreated on next backend start." -ForegroundColor Green
