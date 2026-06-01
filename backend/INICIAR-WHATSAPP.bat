@echo off
title APS-EDU WhatsApp Server
color 0A
chcp 65001 >nul

:: Vai para a pasta do bat (funciona com duplo clique)
cd /d "%~dp0"

echo.
echo  ============================================
echo   APS-EDU WhatsApp Server - Iniciando...
echo  ============================================
echo.

:: Cria pasta de sessao se nao existir
if not exist "session-local" mkdir session-local

:: Cria .env.local se nao existir
if not exist ".env.local" (
    echo PORT=3000 > .env.local
    echo NODE_ENV=production >> .env.local
    echo WHATSAPP_ENABLED=true >> .env.local
    echo WHATSAPP_SESSION_PATH=./session-local >> .env.local
    echo WHATSAPP_MEMORY_PATH=./session-local/sofi-memory.json >> .env.local
    echo WHATSAPP_AI_MODE=assist >> .env.local
    echo GEMINI_API_KEY=AIzaSyCLr-uWFlIh2UHc5nnHB2PwedcD23cANaE >> .env.local
    echo WHATSAPP_GEMINI_MODEL=gemini-2.0-flash-lite >> .env.local
    echo WHATSAPP_API_KEY=7d81fe0ea44f6eb6dda650cccd79ed8f65dfab3182b31a5f1d8481701e305bc2 >> .env.local
    echo WHATSAPP_SYNC_FULL=true >> .env.local
)

echo   Servidor rodando em http://localhost:3000
echo   Feche esta janela para parar.
echo.

:: Usa node do PATH (instalacao real), com fallback para node.exe local
where node >nul 2>&1
if %ERRORLEVEL% == 0 (
    node whatsapp-server.js
) else if exist "%~dp0node.exe" (
    "%~dp0node.exe" whatsapp-server.js
) else (
    echo.
    echo  ERRO: Node.js nao encontrado!
    echo  Instale em https://nodejs.org ou copie node.exe para esta pasta.
    echo.
    pause
    exit /b 1
)

pause
