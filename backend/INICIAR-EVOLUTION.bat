@echo off
title Sofi — Evolution API + Relay + Tunel ngrok
color 0A
chcp 65001 >nul

cd /d "%~dp0"

set "NODE=C:\Users\vinicius.felix\AppData\Local\nodejs\node.exe"
set "PM2=C:\Users\vinicius.felix\AppData\Roaming\npm\node_modules\pm2\bin\pm2"
set "ECOSYSTEM=%~dp0ecosystem.local.config.js"

echo.
echo  ============================================================
echo   Sofi — Evolution API v1.8.2 + Relay SSE + ngrok
echo  ============================================================
echo.

:: Verifica se o Node existe
if not exist "%NODE%" (
    echo  ERRO: Node.js nao encontrado em %NODE%
    pause
    exit /b 1
)

:: Para processos antigos se estiverem rodando
echo  Parando processos antigos...
"%NODE%" "%PM2%" stop evolution-api 2>nul
"%NODE%" "%PM2%" stop sofi-relay 2>nul
"%NODE%" "%PM2%" stop sofi-tunnel 2>nul
"%NODE%" "%PM2%" delete evolution-api 2>nul
"%NODE%" "%PM2%" delete sofi-relay 2>nul
"%NODE%" "%PM2%" delete sofi-tunnel 2>nul

:: Inicia com o novo config
echo  Iniciando Evolution API + Relay SSE + tunel ngrok...
"%NODE%" "%PM2%" start "%ECOSYSTEM%"

:: Aguarda o Evolution API subir antes de registrar o webhook
echo.
echo  Aguardando Evolution API inicializar (15s)...
timeout /t 15 /nobreak >nul

:: Registra o webhook no Evolution API
echo.
echo  Registrando webhook no Evolution API...
"%NODE%" "%~dp0setup-webhook.js"

:: Aguarda mais um pouco
timeout /t 3 /nobreak >nul

:: Mostra status
echo.
"%NODE%" "%PM2%" list

echo.
echo  ============================================================
echo   Tunel:   https://prankster-scored-giver.ngrok-free.dev/
echo   Relay:   http://localhost:8079/relay/events
echo   Evo API: http://localhost:8080/manager
echo   Docs:    http://localhost:8080/docs
echo.
echo   Para conectar o WhatsApp:
echo   Acesse https://aps-edu.vercel.app/whatsapp e clique "Conectar"
echo  ============================================================
echo.

:: Salva config para restart automatico
"%NODE%" "%PM2%" save

pause
