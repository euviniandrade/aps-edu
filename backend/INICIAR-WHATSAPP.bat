@echo off
title APS-EDU WhatsApp Server
color 0A
chcp 65001 >nul

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║   APS-EDU WhatsApp Server — Iniciando...         ║
echo  ╚══════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: ── Verifica Node.js ─────────────────────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERRO: Node.js nao encontrado no PATH.
    echo.
    echo  Instale o Node.js LTS em: https://nodejs.org
    echo  Depois feche e reabra esta janela.
    echo.
    start https://nodejs.org/en/download
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  Node.js %NODE_VER% encontrado.

:: ── Instala dependências se necessário ──────────────────────────────────
if not exist "node_modules\fastify" (
    echo  Instalando dependencias (pode demorar 1-2 minutos)...
    echo.
    call npm install --omit=dev --prefer-offline 2>&1
    if %errorlevel% neq 0 (
        echo  Tentando com npm install normal...
        call npm install --omit=dev 2>&1
    )
    echo.
)

:: ── Cria pasta de sessão ─────────────────────────────────────────────────
if not exist "session-local\" mkdir session-local

:: ── Verifica .env.local ──────────────────────────────────────────────────
if not exist ".env.local" (
    echo  AVISO: Arquivo .env.local nao encontrado.
    echo  Criando com configuracoes padrao...
    echo PORT=3000 > .env.local
    echo WHATSAPP_SESSION_PATH=./session-local >> .env.local
    echo WHATSAPP_MEMORY_PATH=./session-local/sofi-memory.json >> .env.local
    echo WHATSAPP_AI_MODE=assist >> .env.local
    echo GEMINI_API_KEY=AIzaSyCLr-uWFlIh2UHc5nnHB2PwedcD23cANaE >> .env.local
    echo WHATSAPP_GEMINI_MODEL=gemini-2.0-flash-lite >> .env.local
    echo WHATSAPP_API_KEY=7d81fe0ea44f6eb6dda650cccd79ed8f65dfab3182b31a5f1d8481701e305bc2 >> .env.local
    echo.
)

:: ── Inicia servidor ──────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║  Servidor iniciado em http://localhost:3000       ║
echo  ║                                                  ║
echo  ║  Proximos passos:                                ║
echo  ║  1. Abra TUNEL-CLOUDFLARE.bat em outra janela    ║
echo  ║  2. Copie a URL trycloudflare.com                ║
echo  ║  3. Cole no Vercel como BACKEND_URL              ║
echo  ║                                                  ║
echo  ║  Para parar: pressione Ctrl+C                    ║
echo  ╚══════════════════════════════════════════════════╝
echo.

node whatsapp-server.js

pause
