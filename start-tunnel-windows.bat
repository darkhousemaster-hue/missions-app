@echo off
cd /d "%~dp0"
echo.
echo  MiSSiONS - Cloudflare Tunnel
echo  ==============================
echo.
if not exist "%~dp0cloudflared.exe" (
  echo  ERROR: cloudflared.exe not found in %~dp0
  echo  Download: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  pause & exit
)
echo  Starting tunnel... copy the https:// URL into Settings - Public URL
echo  The URL is also saved to tunnel-url.txt automatically.
echo.
:: Clear old URL file
echo. > "%~dp0tunnel-url.txt"
:: Start cloudflared, pipe output through PowerShell to capture the URL
"%~dp0cloudflared.exe" tunnel --url http://localhost:3001 2>&1 | powershell -Command "$input | ForEach-Object { Write-Host $_; if ($_ -match 'https://[a-z0-9\-]+\.trycloudflare\.com') { $matches[0] | Out-File -FilePath '%~dp0tunnel-url.txt' -Encoding UTF8 -Force } }"
