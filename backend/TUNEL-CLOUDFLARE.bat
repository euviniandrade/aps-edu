@echo off
title APS-EDU Tunnel Cloudflare
color 0B

echo.
echo  ================================================
echo   Criando tunel publico para o WhatsApp Server
echo  ================================================
echo.

:: Verifica se cloudflared está instalado
where cloudflared >nul 2>&1
if %errorlevel% neq 0 (
    echo  Baixando cloudflared...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'}"
    if exist cloudflared.exe (
        echo  cloudflared baixado com sucesso!
    ) else (
        echo  ERRO: Nao foi possivel baixar cloudflared.
        echo  Baixe manualmente em: https://github.com/cloudflare/cloudflared/releases
        pause
        exit /b 1
    )
)

echo.
echo  Iniciando tunel na porta 3000...
echo  IMPORTANTE: Copie a URL "trycloudflare.com" que aparecer
echo  e cole no Vercel como variavel BACKEND_URL
echo.
echo  Exemplo: https://xxxx-yyyy.trycloudflare.com/api
echo  ================================================
echo.

cloudflared tunnel --url http://localhost:3000

pause
