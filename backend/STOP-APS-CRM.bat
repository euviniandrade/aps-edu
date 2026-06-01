@echo off
title STOP APS CRM
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ==========================================
echo  APS-EDU CRM - STOP
echo ==========================================
echo  Pasta: %cd%
echo.

echo [1/3] Encerrando janelas auxiliares...
taskkill /FI "WINDOWTITLE eq APS-CRM Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq APS-CRM Tunnel*" /F >nul 2>&1

echo [2/3] Encerrando node whatsapp.js...
powershell -NoProfile -Command ^
  "$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'whatsapp\.js' }; " ^
  "foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }"

echo [3/3] Encerrando cloudflared tunnel 8081...
powershell -NoProfile -Command ^
  "$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cloudflared.exe' -and $_.CommandLine -match 'tunnel' -and $_.CommandLine -match '8081' }; " ^
  "foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo OK. Tudo finalizado.
pause
