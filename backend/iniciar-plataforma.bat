@echo off
REM ════════════════════════════════════════════════════════════════════════════
REM 🚀 INICIAR APS EDU - WHATSAPP CRM (simplesmente duplo-clique!)
REM ════════════════════════════════════════════════════════════════════════════

chcp 65001 >nul 2>&1

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║           🚀 INICIANDO APS EDU - WHATSAPP CRM                 ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Executar o script PowerShell
powershell.exe -ExecutionPolicy Bypass -File "%~dp0iniciar-plataforma.ps1"

echo.
pause
