@echo off
title Atualizar URL Vercel
color 0E
chcp 65001 >nul

cd /d "%~dp0"

echo.
echo  ============================================
echo   Atualizando BACKEND_URL no Vercel
echo  ============================================
echo.

:: Le a URL do log do cloudflared
set "LOGFILE=%~dp0cf-tunnel.log"
if not exist "%LOGFILE%" (
    echo  ERRO: cf-tunnel.log nao encontrado.
    echo  Execute primeiro o TUNEL-CLOUDFLARE.bat
    pause
    exit /b 1
)

:: Extrai a URL do log
for /f "tokens=*" %%i in ('powershell -Command "Select-String -Path \"%LOGFILE%\" -Pattern \"https://[\w-]+\.trycloudflare\.com\" | ForEach-Object { $_.Matches[0].Value } | Select-Object -Last 1"') do set "TUNNEL_URL=%%i"

if "%TUNNEL_URL%"=="" (
    echo  ERRO: Nao foi possivel encontrar a URL no log.
    echo  Aguarde o cloudflared conectar e tente novamente.
    pause
    exit /b 1
)

set "BACKEND_URL=%TUNNEL_URL%/api"
echo  URL encontrada: %TUNNEL_URL%
echo  BACKEND_URL: %BACKEND_URL%
echo.

:: Verifica node
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    set "PATH=C:\Program Files\nodejs;%PATH%"
)

:: Atualiza no Vercel
echo  Atualizando Vercel...
npx vercel env rm BACKEND_URL production --yes
echo %BACKEND_URL%| npx vercel env add BACKEND_URL production

echo.
echo  Fazendo redeploy...
npx vercel --prod --yes

echo.
echo  ============================================
echo   Pronto! Acesse: https://aps-edu.vercel.app
echo  ============================================
echo.
pause
