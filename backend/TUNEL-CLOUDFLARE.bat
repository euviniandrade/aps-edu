@echo off
title APS-EDU Tunel Cloudflare
color 0B
chcp 65001 >nul

cd /d "%~dp0"

echo.
echo  ============================================
echo   Tunel Cloudflare - Expondo porta 8081
echo  ============================================
echo.

:: Baixa cloudflared se nao existir
if not exist "cloudflared.exe" (
    echo  Baixando cloudflared...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -UseBasicParsing"
)

:: Inicia o tunel salvando log
echo  Iniciando tunel...
echo  Aguarde a URL aparecer abaixo e copie para o Vercel.
echo.

:: Roda cloudflared e salva log
cloudflared.exe tunnel --url http://localhost:8081 --logfile "%~dp0cf-tunnel.log" 2>&1

pause
