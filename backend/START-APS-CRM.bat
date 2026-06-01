@echo off
title START APS CRM
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ==========================================
echo  APS-EDU CRM - START
echo ==========================================
echo  Pasta: %cd%
echo.

if not exist "whatsapp.js" (
  echo [ERRO] Arquivo whatsapp.js nao encontrado.
  pause
  exit /b 1
)

if not exist "cloudflared.exe" (
  echo [ERRO] cloudflared.exe nao encontrado em:
  echo        %cd%\cloudflared.exe
  pause
  exit /b 1
)

echo [1/2] Iniciando backend (node whatsapp.js)...
start "APS-CRM Backend" cmd /k "cd /d %cd% && node whatsapp.js"

timeout /t 4 /nobreak >nul

echo [2/2] Iniciando tunel Cloudflare (porta 8081)...
start "APS-CRM Tunnel" cmd /k "cd /d %cd% && .\cloudflared.exe tunnel --url http://localhost:8081"

echo.
echo OK. Aguarde ~10s e valide:
echo   http://localhost:8081/status
echo   https://aps-edu.vercel.app/api/whatsapp-live/status
echo.
pause
